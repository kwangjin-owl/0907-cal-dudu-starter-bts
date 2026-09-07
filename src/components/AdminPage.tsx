import React, { useState, useEffect } from 'react';
import { SlotTable } from './SlotTable';
import type { Slot, Request, Candidate, OperationLog } from '../types';
import { OperationManager } from '../utils/operations';
import { DatabaseManager } from '../utils/database';
import { TIME_SLOTS } from '../utils/constants';
import * as supabaseApi from '../utils/supabase';
import { decideRequestStatus } from '../utils/decide';

// 접수 시각부터 지금까지 얼마나 지났는지 사람이 읽는 말로 바꾼다
function elapsedText(createdAt: string | Date): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  if (ms < 0) return '방금';
  const min = Math.floor(ms / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간`;
  const day = Math.floor(hour / 24);
  return `${day}일`;
}

interface AdminPageProps {
  db: DatabaseManager;
  mode: 'local' | 'supabase';
  userId?: string | null;
}

export const AdminPage: React.FC<AdminPageProps> = ({ db, mode, userId }) => {
  const [adminId] = useState<string>(userId || 'ADMIN001');
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [requests, setRequests] = useState<
    Array<{ request: Request; candidates: Candidate[]; decision: any }>
  >([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [selectedSlotForConfirm, setSelectedSlotForConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const om = new OperationManager(db);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [mode, userId]);

  const loadData = async () => {
    if (mode === 'supabase' && userId) {
      await loadSupabaseData();
    } else {
      loadLocalData();
    }
  };

  const loadLocalData = () => {
    const state = db.getState();
    setSlots(state.slots);
    setRequests(om.getAdminRequests());
    setLogs(state.logs || []);
    setError('');
    setSuccess('');
  };

  const loadSupabaseData = async () => {
    try {
      const slotData = await supabaseApi.getSlots() as any[];
      const { requests: requestData, candidates: candidateData } = await supabaseApi.getAllRequests();
      const logsData = await supabaseApi.getLogs() as any[];

      const slotMap: Record<string, Slot> = {};
      slotData.forEach((s: any) => {
        slotMap[s.id] = {
          id: s.id,
          date: s.date,
          timeLabel: s.time_label,
          status: s.status as 'available' | 'confirmed',
          confirmedAt: s.confirmed_at,
          confirmedBy: s.confirmed_by,
        };
      });

      const convertedRequests = requestData.map((r: any) => ({
        id: r.id,
        customerId: r.customer_id,
        version: r.version,
        createdAt: r.created_at,
        status: r.status as 'received' | 'needs_reselection' | 'confirmed',
        confirmedSlotId: r.confirmed_slot_id,
        confirmedAt: r.confirmed_at,
      }));

      const convertedCandidates = candidateData.map((c: any) => ({
        id: c.id,
        requestId: c.request_id,
        slotId: c.slot_id,
        priority: c.priority,
        version: c.version,
        queueSeq: c.queue_seq,
      }));

      const status = convertedRequests
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(req => ({
          request: req,
          candidates: convertedCandidates.filter(c => c.requestId === req.id).sort((a, b) => a.priority - b.priority),
          decision: decideRequestStatus(req, convertedCandidates, slotMap),
        }));

      setSlots(slotMap);
      setRequests(status);

      const convertedLogs = logsData.map((l: any) => ({
        id: l.id,
        timestamp: l.created_at || l.timestamp,
        action: l.action as 'submit' | 'confirm' | 'reselect',
        requestId: l.request_id || '',
        adminId: l.admin_id,
        slotId: l.slot_id,
        status: l.status as 'success' | 'failed',
        error: l.error_message,
      }));

      setLogs(convertedLogs);
      setError('');
      setSuccess('');
    } catch (err) {
      setError(`데이터 조회 실패: ${String(err)}`);
    }
  };

  const handleConfirm = async () => {
    if (!selectedRequest || !selectedSlotForConfirm) {
      setError('요청과 슬롯을 선택하세요');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const operationId = `confirm-${selectedRequest}-${selectedSlotForConfirm}-${Date.now()}`;
      let result;

      if (mode === 'supabase' && userId) {
        result = await supabaseApi.confirmRequest(selectedRequest, selectedSlotForConfirm, userId, operationId);
      } else {
        result = await om.confirmRequest(selectedRequest, selectedSlotForConfirm, adminId, operationId);
      }

      if (result.success) {
        setSuccess(`확정되었습니다! 영향받은 요청: ${result.affectedRequests?.length || 0}건`);
        setSelectedRequest(null);
        setSelectedSlotForConfirm(null);
        setTimeout(() => loadData(), 500);
      } else {
        setError(result.error || '확정 실패');
      }
    } catch (err) {
      setError(`확정 오류: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const currentRequest = selectedRequest ? requests.find(r => r.request.id === selectedRequest) : null;

  // 고객 UUID를 C01, C02... 라벨로 바꾸기 (먼저 신청한 순서)
  const customerLabels = new Map<string, string>();
  requests.forEach(item => {
    const id = item.request.customerId;
    if (!customerLabels.has(id)) {
      customerLabels.set(id, `C${String(customerLabels.size + 1).padStart(2, '0')}`);
    }
  });
  const labelOf = (id: string) => `${customerLabels.get(id) ?? '??'} (${id.slice(0, 8)})`;

  return (
    <div className="admin-page">
      <h2>어드민 패널</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="grid">
        {/* 요청 목록 */}
        <div>
          <h3>신청 목록 (총 {requests.length}건)</h3>
          <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            <ul className="list" style={{ margin: 0 }}>
              {requests.map((item, idx) => (
                <li
                  key={item.request.id}
                  onClick={() => {
                    setSelectedRequest(item.request.id);
                    setSelectedSlotForConfirm(null);
                  }}
                  style={{
                    cursor: 'pointer',
                    background: selectedRequest === item.request.id ? '#e7f3ff' : 'white',
                    borderColor: selectedRequest === item.request.id ? '#007bff' : '#ddd',
                    marginBottom: '0',
                    borderRadius: '0',
                    borderBottom: '1px solid #ddd',
                  }}
                >
                  <div>
                    <strong>#{idx + 1}</strong> {labelOf(item.request.customerId)} (v
                    {item.request.version})
                    <br />
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(item.request.createdAt).toLocaleString()}
                    </span>
                    {item.request.status !== 'confirmed' && (
                      <span style={{
                        marginLeft: '8px', fontSize: '12px', fontWeight: 'bold',
                        color: '#b4472e', background: '#fbf1ef',
                        border: '1px solid #e3c5bd', borderRadius: '3px', padding: '1px 6px',
                      }}>
                        {elapsedText(item.request.createdAt)} 대기 중
                      </span>
                    )}
                    <br />
                    <span className={`slot-status ${item.request.status === 'confirmed' ? 'confirmed' : 'available'}`}>
                      {item.request.status === 'confirmed'
                        ? '확정됨'
                        : item.request.status === 'needs_reselection'
                          ? '재선택필요'
                          : '접수됨'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 요청 상세 */}
        <div>
          <h3>요청 상세</h3>
          {currentRequest ? (
            <div style={{ padding: '16px', background: 'white', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div className="form-group">
                <label>고객 코드</label>
                <input type="text" value={labelOf(currentRequest.request.customerId)} disabled />
              </div>

              <div className="form-group">
                <label>상태</label>
                <input
                  type="text"
                  value={
                    currentRequest.request.status === 'confirmed'
                      ? '확정됨'
                      : currentRequest.request.status === 'needs_reselection'
                        ? '재선택필요'
                        : '접수됨'
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>희망 슬롯 (우선순위 순)</label>
                <ul className="list">
                  {currentRequest.candidates.map((c, idx) => {
                    const slot = slots[c.slotId];
                    const isAvailable = slot?.status === 'available';
                    return (
                      <li
                        key={c.id}
                        onClick={() => {
                          if (isAvailable && currentRequest.request.status !== 'confirmed') {
                            setSelectedSlotForConfirm(c.slotId);
                          }
                        }}
                        style={{
                          cursor: isAvailable && currentRequest.request.status !== 'confirmed' ? 'pointer' : 'default',
                          background:
                            selectedSlotForConfirm === c.slotId
                              ? '#d4edda'
                              : isAvailable
                                ? 'white'
                                : '#f8d7da',
                          borderColor: selectedSlotForConfirm === c.slotId ? '#28a745' : '#ddd',
                        }}
                      >
                        <span>
                          {idx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                          {' '}
                          <span style={{ marginLeft: '10px', fontSize: '12px' }}>
                            {isAvailable ? '(가능)' : '(마감)'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {currentRequest.request.status === 'confirmed' && currentRequest.request.confirmedSlotId && (
                <div className="alert alert-success">
                  <strong>확정 완료</strong>
                  <br />
                  {slots[currentRequest.request.confirmedSlotId]?.date}{' '}
                  {TIME_SLOTS.find(t => t.label === slots[currentRequest.request.confirmedSlotId!]?.timeLabel)?.displayLabel}
                  <br />
                  {new Date(currentRequest.request.confirmedAt!).toLocaleString()}
                </div>
              )}

              {currentRequest.request.status !== 'confirmed' && (
                <button
                  className="btn btn-success"
                  onClick={handleConfirm}
                  disabled={!selectedSlotForConfirm || loading}
                  style={{ marginTop: '10px', width: '100%' }}
                >
                  {loading ? '처리 중...' : '확정'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '16px', background: '#f0f0f0', borderRadius: '4px', color: '#666' }}>
              목록에서 요청을 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* 슬롯 현황 */}
      <div style={{ marginTop: '40px' }}>
        <h3>슬롯 현황 (표시용)</h3>
        <SlotTable slots={slots} selectedSlots={[]} onToggle={() => {}} mode="view" />
      </div>

      {/* 실행 기록 */}
      <div style={{ marginTop: '40px' }}>
        <h3>실행 기록 (최근 20건)</h3>
        <div className="table-container">
          <table className="slots-table">
            <thead>
              <tr>
                <th>시간</th>
                <th>행위</th>
                <th>요청ID</th>
                <th>슬롯</th>
                <th>결과</th>
                <th>오류</th>
              </tr>
            </thead>
            <tbody>
              {logs
                .slice()
                .reverse()
                .slice(0, 20)
                .map(log => (
                  <tr key={log.id} style={{ fontSize: '12px' }}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>{log.action}</td>
                    <td style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                      {log.requestId.substring(0, 8)}...
                    </td>
                    <td>{log.slotId ? log.slotId : '-'}</td>
                    <td>
                      <span style={{ color: log.status === 'success' ? '#28a745' : '#dc3545' }}>
                        {log.status === 'success' ? '성공' : '실패'}
                      </span>
                    </td>
                    <td style={{ color: '#dc3545' }}>{log.error ? log.error.substring(0, 30) : '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};