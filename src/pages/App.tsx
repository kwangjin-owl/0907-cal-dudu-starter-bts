import React, { useState, useEffect } from 'react';
import { CustomerPage } from '../components/CustomerPage';
import { AdminPage } from '../components/AdminPage';
import { LoginPage } from '../components/LoginPage';
import { DatabaseManager } from '../utils/database';
import { REFERENCE_TIME } from '../utils/constants';
import { isSupabaseConfigured, getCurrentUser, getAdminStatus, signOut } from '../utils/supabase';

type Mode = 'local' | 'supabase';
type Role = 'customer' | 'admin';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('local');
  const [role, setRole] = useState<Role>('customer');
  const [db] = useState(() => new DatabaseManager());
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // 초기화: Supabase 모드 감지 및 인증 상태 확인
  useEffect(() => {
    const initialize = async () => {
      try {
        if (isSupabaseConfigured()) {
          setMode('supabase');
          const user = await getCurrentUser();
          if (user) {
            setUserId(user.id);
            setUserEmail(user.email ?? null);
            const admin = await getAdminStatus();
            setRole(admin ? 'admin' : 'customer');
          } else {
            setRole('customer');
          }
        } else {
          setMode('local');
        }
      } catch (error) {
        setAuthError(`초기화 오류: ${String(error)}`);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const handleRoleChange = (newRole: Role) => {
    if (mode === 'local') {
      setRole(newRole);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      // 세션이 이미 없는 경우는 이미 로그아웃된 것이므로 오류로 보지 않는다
      const msg = String(error);
      if (!msg.includes('Auth session missing')) {
        setAuthError(`로그아웃 실패: ${msg}`);
        return;
      }
    }
    setUserId(null);
    setUserEmail(null);
    window.location.reload();
  };

  const handleResetData = () => {
    if (mode === 'local') {
      if (window.confirm('모든 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        db.reset();
        window.location.reload();
      }
    } else {
      setAuthError('Supabase 모드에서는 데이터 초기화를 지원하지 않습니다');
    }
  };

  if (loading) {
    return <div className="container"><p>초기화 중...</p></div>;
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>cal.dudu-works.com</h1>
          <div className="reference-time">
            기준 시각: {REFERENCE_TIME.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (고정)
          </div>
        </div>

        <div className="role-selector">
          {mode === 'local' && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>역할</span>
              <button
                className={`btn ${role === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleRoleChange('customer')}
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                고객
              </button>
              <button
                className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleRoleChange('admin')}
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                어드민
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px' }}>
            {mode === 'local' && <span className={`mode-badge ${mode}`}>로컬 모드</span>}
            {mode === 'supabase' && userId && (
              <button
                className="btn btn-secondary"
                onClick={handleSignOut}
                style={{ padding: '6px 12px', fontSize: '12px', background: '#6c757d', color: 'white', border: 'none' }}
              >
                로그아웃
              </button>
            )}
            {mode === 'local' && (
              <button
                className="btn btn-secondary"
                onClick={handleResetData}
                style={{ padding: '6px 12px', fontSize: '12px', background: '#6c757d', color: 'white', border: 'none' }}
              >
                데이터 초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {authError && <div className="alert alert-error">{authError}</div>}

      {mode === 'local' && (
        <div className="alert alert-info">
          <strong>로컬 모드:</strong> 브라우저 로컬 스토리지에 데이터를 저장합니다. 진짜 인증이 아닌 수업용 데모입니다.
          역할 전환은 이 모드에만 있습니다.
        </div>
      )}

      {mode === 'supabase' && !userId ? (
        <LoginPage onLoginSuccess={() => window.location.reload()} />
      ) : (
        <>
          {role === 'customer' && <CustomerPage db={db} mode={mode} userId={userId} userEmail={userEmail} />}
          {role === 'admin' && <AdminPage db={db} mode={mode} userId={userId} />}
        </>
      )}

      {/* 산출물 바로 열기 */}
      <a
        href="/service_blueprint.html"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed', right: '20px', bottom: '20px', zIndex: 100,
          display: 'inline-block', padding: '10px 16px',
          background: '#14263B', color: 'white', fontSize: '13px', fontWeight: 'bold',
          borderRadius: '4px', textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(20,38,59,0.3)',
        }}
      >
        Service Blueprint (As-Is → To-Be)
      </a>

      <hr style={{ margin: '24px 0 12px', borderColor: '#e5e5e5' }} />
      <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', paddingBottom: '16px' }}>
        cal.dudu-works.com
      </div>
    </div>
  );
};

export default App;