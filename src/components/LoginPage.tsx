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

        <div className="alert alert-info" style={{ marginTop: '20px', fontSize: '12px' }}>
          <strong>테스트 사용자 만들기:</strong>
          <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Supabase 콘솔 → Authentication → Users</li>
            <li>Add user로 사용자 생성</li>
            <li>어드민: app_metadata에 {'{'}role: admin{'}'} 설정</li>
            <li>여기서 로그인</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
