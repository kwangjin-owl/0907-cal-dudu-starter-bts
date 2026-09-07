import React, { useState } from 'react';
import * as supabaseApi from '../utils/supabase';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('이메일과 비밀번호를 입력하세요');
        setLoading(false);
        return;
      }

      await supabaseApi.signInCustomer(email, password);
      onLoginSuccess();
    } catch (err) {
      setError(`로그인 실패: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // 구글로 로그인하면 캘린더에 일정을 넣을 권한까지 함께 받는다.
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await supabaseApi.signInWithGoogle();
      // 구글 화면으로 넘어가므로 여기서 더 할 일은 없다
    } catch (err) {
      setError(`구글 로그인 실패: ${String(err)}`);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="login-container">
        <h1>cal.dudu-works.com</h1>
        <h2>Supabase 로그인</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="customer1@example.com"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            margin: '18px 0 14px', color: '#888', fontSize: '12px',
          }}
        >
          <span style={{ flex: 1, height: '1px', background: '#ddd' }} />
          또는
          <span style={{ flex: 1, height: '1px', background: '#ddd' }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '11px', fontSize: '14px', fontWeight: 'bold',
            background: 'white', color: '#3c4043',
            border: '1px solid #dadce0', borderRadius: '4px', cursor: 'pointer',
          }}
        >
          구글로 로그인
        </button>
        <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0', textAlign: 'center' }}>
          구글로 로그인하면 확정된 예약을 캘린더에 바로 넣을 수 있습니다.
        </p>

        <div className="alert alert-info" style={{ marginTop: '20px', fontSize: '12px' }}>
          <strong>테스트 사용자 만들기:</strong>
          <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Supabase 콘솔 → Authentication → Users</li>
            <li>Add user로 사용자 생성 (Auto Confirm User 체크)</li>
            <li>
              어드민 권한은 화면에 설정하는 칸이 없습니다. SQL Editor에서
              auth.users의 raw_app_meta_data에 {'{'}"role":"admin"{'}'}을 넣으세요.
            </li>
            <li>여기서 로그인</li>
          </ol>
        </div>
      </div>
    </div>
  );
};