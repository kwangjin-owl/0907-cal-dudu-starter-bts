import React, { useState, useEffect } from 'react';
import { SlotTable } from './SlotTable';
import type { Slot, Request, Candidate } from '../types';
import { OperationManager } from '../utils/operations';
import { DatabaseManager } from '../utils/database';
import { decideRequestStatus } from '../utils/decide';
import { TIME_SLOTS } from '../utils/constants';
import * as supabaseApi from '../utils/supabase';

// 접수 시각부터 지금까지 얼마나 지났는지 사람이 읽는 말로 바꾼다
function elapsedText(createdAt: string | Date): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  if (ms < 0) return '방금';
  const min = Math.floor(ms / 60000);
  if (min < 1) return '1분 미만';
  if (min < 60) return `${min}분`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간`;
  const day = Math.floor(hour / 24);
  return `${day}일 ${hour % 24}시간`;
}

interface CustomerPageProps {
  db: DatabaseManager;
  mode: 'local' | 'supabase';
  userId?: string | null;
}

export const CustomerPage: React.FC<CustomerPageProps> = ({ db, mode, userId }) => {
  const [customerId, setCustomerId] = useState<string>('C01');
  const [stage, setStage] = useState<'select' | 'confirm' | 'view' | 'reselect'>('select');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [customerRequests, setCustomerRequests] = useState<
    Array<{ request: Request; candidates: Candidate[]; decision: any }>
  >([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const om = new OperationManager(db);
  const effectiveCustomerId = mode === 'supabase' && userId ? userId : customerId;

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [customerId, userId, mode]);

  // 마지막으로 화면을 갱신한 시각 (자동 갱신 표시용)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());

  // 확정을 기다리는 중인지 (접수됨 상태가 하나라도 있으면 대기 중)
  const isWaiting = customerRequests.some(item => item.request.status === 'received');

  // 자동 갱신: 대기 중일 때만 30초마다 다시 조회한다.
  // 알림을 보내는 게 아니라 화면이 스스로 최신 상태를 다시 읽어오는 것.
  useEffect(() => {
    if (stage !== 'view' || !isWaiting) return;
    const timer = setInterval(() => {
      loadData();
      setLastSyncedAt(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, [stage, isWaiting, customerId, userId, mode]);

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
    const status = om.getCustomerStatus(customerId);
    setCustomerRequests(status);
    setError('');
    setSuccess('');

    if (status.length === 0) {
      setStage('select');
      setSelectedSlots([]);
    } else {
      const latest = status[status.length - 1];
      if (latest.request.status === 'needs_reselection') {
        setStage('reselect');
      } else {
        setStage('view');
      }
    }
  };

  const loadSupabaseData = async () => {
    try {
      const slotData = (await supabaseApi.getSlots()) as any[];
      const { requests, candidates } = await supabaseApi.getMyRequests(userId!);

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

      const convertedRequests = requests.map((r: any) => ({
        id: r.id,
        customerId: r.customer_id,
        version: r.version,
        createdAt: r.created_at,
        status: r.status as 'received' | 'needs_reselection' | 'confirmed',
        confirmedSlotId: r.confirmed_slot_id,
        confirmedAt: r.confirmed_at,
      }));

      const convertedCandidates = candidates.map((c: any) => ({
        id: c.id,
        requestId: c.request_id,
        slotId: c.slot_id,
        priority: c.priority,
        version: c.version,
        queueSeq: c.queue_seq,
      }));

      setSlots(slotMap);

      const status = convertedRequests.map(req => ({
        request: req,
        candidates: convertedCandidates.filter(c => c.requestId === req.id).sort((a, b) => a.priority - b.priority),
        decision: decideRequestStatus(req, convertedCandidates, slotMap),
      }));

      setCustomerRequests(status);

      if (status.length === 0) {
        setStage('select');
        setSelectedSlots([]);
      } else {
        const latest = status[status.length - 1];
        if (latest.request.status === 'needs_reselection') {
          setStage('reselect');
        } else {
          setStage('view');
        }
      }

      setError('');
      setSuccess('');
    } catch (err) {
      setError(`데이터 조회 실패: ${String(err)}`);
    }
  };

  const handleSlotToggle = (slotId: string) => {
    setSelectedSlots(prev => {
      if (prev.includes(slotId)) {
        return prev.filter(s => s !== slotId);
      } else if (prev.length < 3) {
        return [...prev, slotId];
      }
      return prev;
    });
    setError('');
  };

  const handleSubmit = async () => {
    if (selectedSlots.length === 0) {
      setError('최소 1개 이상의 슬롯을 선택하세요');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const operationId = `submit-${effectiveCustomerId}-${Date.now()}`;
      let result;

      if (mode === 'supabase' && userId) {
        result = await supabaseApi.submitRequest(userId, selectedSlots, operationId);
      } else {
        result = await om.submitRequest(effectiveCustomerId, selectedSlots, operationId);
      }

      if (result.success) {
        setSuccess('신청이 완료되었습니다!');
        setSelectedSlots([]);
        setStage('view');
        setTimeout(() => loadData(), 500);
      } else {
        setError(result.error || '신청 실패');
      }
    } catch (err) {
      setError(`신청 오류: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReselect = async () => {
    if (selectedSlots.length === 0) {
      setError('최소 1개 이상의 슬롯을 선택하세요');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const latest = customerRequests[customerRequests.length - 1];
      const operationId = `reselect-${latest.request.id}-${Date.now()}`;
      let result;

      if (mode === 'supabase' && userId) {
        result = await supabaseApi.resubmitRequest(userId, latest.request.id, selectedSlots, operationId);
      } else {
        result = await om.resubmitRequest(effectiveCustomerId, latest.request.id, selectedSlots, operationId);
      }

      if (result.success) {
        setSuccess('재선택이 완료되었습니다!');
        setSelectedSlots([]);
        setStage('view');
        setTimeout(() => loadData(), 500);
      } else {
        setError(result.error || '재선택 실패');
      }
    } catch (err) {
      setError(`재선택 오류: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedSlots([]);
    setStage('view');
    setError('');
  };

  // 슬롯 상태가 변경되었는지 확인
  const checkSlotAvailability = () => {
    if (stage === 'confirm' && customerRequests.length > 0) {
      const latest = customerRequests[customerRequests.length - 1];
      const currentState = db.getState();
      const decision = decideRequestStatus(latest.request, currentState.candidates, currentState.slots);

      if (decision.status !== 'ok') {
        setError('선택한 슬롯의 상태가 변경되었습니다. 다시 선택해주세요.');
        setStage('reselect');
        setSelectedSlots([]);
        return false;
      }
    }
    return true;
  };

  return (
    <div className="customer-page">
      <div className="form-group">
        <label>고객 코드</label>
        {mode === 'supabase' ? (
          <input
            type="text"
            value={userId ? `내 계정 (${userId.slice(0, 8)})` : '로그인 필요'}
            disabled
          />
        ) : (
          <input
            type="text"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            placeholder="C01"
            disabled={stage === 'confirm'}
          />
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {stage === 'select' && (
        <div>
          <h3>슬롯 선택 (1~3개)</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            원하는 슬롯을 선택하고 제출하세요. 선택 순서가 희망 우선순위입니다.
          </p>
          <SlotTable
            slots={slots}
            selectedSlots={selectedSlots}
            onToggle={handleSlotToggle}
            mode="select"
            maxSelect={3}
          />

          <div style={{ marginBottom: '20px' }}>
            <h4>선택한 슬롯 ({selectedSlots.length}/3)</h4>
            <ul className="list">
              {selectedSlots.map((slotId, idx) => {
                const slot = slots[slotId];
                return (
                  <li key={slotId}>
                    <span>
                      {idx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleSlotToggle(slotId)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      제거
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setStage('confirm')}
            disabled={selectedSlots.length === 0 || loading}
          >
            다음: 최종 확인
          </button>
        </div>
      )}

      {stage === 'confirm' && checkSlotAvailability() && (
        <div>
          <h3>최종 확인</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            다음과 같이 신청합니다. 제출하면 어드민이 확인 후 확정합니다.
          </p>
          <SlotTable slots={slots} selectedSlots={selectedSlots} onToggle={() => {}} mode="view" />

          <div style={{ marginBottom: '20px' }}>
            <h4>최종 선택 (우선순위 순)</h4>
            <ul className="list">
              {selectedSlots.map((slotId, idx) => {
                const slot = slots[slotId];
                return (
                  <li key={slotId}>
                    <span>
                      {idx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '처리 중...' : '제출'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              돌아가기
            </button>
          </div>
        </div>
      )}

      {stage === 'view' && customerRequests.length > 0 && (
        <div>
          <h3>내 신청 현황</h3>

          {isWaiting && (
            <div className="alert alert-info" style={{ marginBottom: '16px' }}>
              <strong>확정을 기다리는 중입니다.</strong>{' '}
              관리자가 신청하신 시간 중 하나를 확정하면 이 화면이 자동으로 바뀝니다.
              확정 안내는 접수 순서대로, 하루 안에 드립니다.
              <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                이 화면은 30초마다 저절로 새로고침됩니다.
                마지막 확인: {lastSyncedAt.toLocaleTimeString()}
              </div>
            </div>
          )}

          {customerRequests.map((item, idx) => (
            <div key={item.request.id} style={{ marginBottom: '20px', padding: '16px', background: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
              <h4>신청 #{item.request.version} (접수일: {new Date(item.request.createdAt).toLocaleString()})</h4>

              {item.request.status === 'received' && (
                <p style={{ fontSize: '13px', color: '#666', margin: '-6px 0 12px' }}>
                  접수한 지 <strong>{elapsedText(item.request.createdAt)}</strong> 지났습니다.
                </p>
              )}

              <div className="form-group">
                <label>상태</label>
                <div style={{ padding: '8px', background: '#f0f0f0', borderRadius: '4px' }}>
                  {item.request.status === 'confirmed' && (
                    <span className="slot-status confirmed">확정됨</span>
                  )}
                  {item.request.status === 'received' && (
                    <span className="slot-status available">접수됨</span>
                  )}
                  {item.request.status === 'needs_reselection' && (
                    <span className="alert alert-warning">재선택 필요</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>선택한 슬롯 (우선순위 순)</label>
                <ul className="list">
                  {item.candidates.map((c, cidx) => {
                    const slot = slots[c.slotId];
                    const isAvailable = slot?.status === 'available';
                    return (
                      <li key={c.id}>
                        <span>
                          {cidx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                          {' '}
                          <span style={{ marginLeft: '10px', fontSize: '12px', color: isAvailable ? '#28a745' : '#dc3545' }}>
                            {isAvailable ? '(가능)' : '(마감)'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {item.request.status === 'received' && (() => {
                const openCount = item.candidates.filter(
                  c => slots[c.slotId]?.status === 'available'
                ).length;
                if (openCount === 0) return null;
                if (openCount === 1) {
                  return (
                    <div className="alert alert-warning">
                      <strong>남은 시간이 1개입니다.</strong>{' '}
                      이 시간마저 다른 분에게 확정되면 처음부터 다시 골라야 합니다.
                    </div>
                  );
                }
                return (
                  <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px' }}>
                    아직 선택할 수 있는 시간이 {openCount}개 남아 있습니다.
                  </p>
                );
              })()}

              {item.request.status === 'confirmed' && (
                <div className="alert alert-success">
                  <strong>확정됨!</strong> {slots[item.request.confirmedSlotId!]?.date}{' '}
                  {TIME_SLOTS.find(t => t.label === slots[item.request.confirmedSlotId!]?.timeLabel)?.displayLabel}에
                  확정되었습니다.
                </div>
              )}

              {item.request.status === 'needs_reselection' && idx === customerRequests.length - 1 && (
                <button
                  className="btn btn-warning"
                  onClick={() => {
                    setStage('reselect');
                    setSelectedSlots([]);
                  }}
                  style={{ background: '#ffc107', marginTop: '10px' }}
                >
                  재선택하기
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {stage === 'reselect' && customerRequests.length > 0 && (
        <div>
          <h3>슬롯 재선택</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            이전 신청의 슬롯이 모두 마감되었습니다. 다시 선택해주세요.
          </p>
          <SlotTable
            slots={slots}
            selectedSlots={selectedSlots}
            onToggle={handleSlotToggle}
            mode="select"
            maxSelect={3}
          />

          <div style={{ marginBottom: '20px' }}>
            <h4>새로 선택한 슬롯 ({selectedSlots.length}/3)</h4>
            <ul className="list">
              {selectedSlots.map((slotId, idx) => {
                const slot = slots[slotId];
                return (
                  <li key={slotId}>
                    <span>
                      {idx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleSlotToggle(slotId)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      제거
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={handleReselect}
              disabled={selectedSlots.length === 0 || loading}
            >
              {loading ? '처리 중...' : '재선택 제출'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setStage('view');
                setSelectedSlots([]);
              }}
              disabled={loading}
            >
              돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};