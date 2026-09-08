import React, { useState } from 'react';
import * as supabaseApi from '../utils/supabase';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('이메일과 비밀번호를 입력하세요');
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        if (password.length < 6) {
          setError('비밀번호는 6자 이상으로 정해 주세요');
          setLoading(false);
          return;
        }
        await supabaseApi.signUpCustomer(email, password);
        // 가입 직후 바로 로그인시킨다
        await supabaseApi.signInCustomer(email, password);
        onLoginSuccess();
        return;
      }

      await supabaseApi.signInCustomer(email, password);
      onLoginSuccess();
    } catch (err) {
      const msg = String(err);
      if (mode === 'signup' && msg.includes('already registered')) {
        setError('이미 가입된 이메일입니다. 로그인해 주세요.');
      } else if (mode === 'login' && msg.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 맞지 않습니다. 처음이시면 가입하기를 눌러 주세요.');
      } else {
        setError(`${mode === 'signup' ? '가입' : '로그인'} 실패: ${msg}`);
      }
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
        <h2>{mode === 'login' ? '로그인' : '가입하기'}</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-info">{notice}</div>}

        <form onSubmit={handleSubmit} className="login-form">
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
              placeholder={mode === 'signup' ? '6자 이상' : '비밀번호'}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            {loading
              ? (mode === 'signup' ? '가입 중...' : '로그인 중...')
              : (mode === 'signup' ? '가입하고 시작하기' : '로그인')}
          </button>
        </form>

        <p style={{ fontSize: '13px', color: '#555', margin: '12px 0 0', textAlign: 'center' }}>
          {mode === 'login' ? '처음이신가요?' : '이미 계정이 있으신가요?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setNotice('');
            }}
            disabled={loading}
            style={{
              border: 'none', background: 'none', padding: 0,
              color: '#0b5ed7', fontWeight: 'bold', fontSize: '13px',
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            {mode === 'login' ? '가입하기' : '로그인하기'}
          </button>
        </p>

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
      </div>
    </div>
  );
};