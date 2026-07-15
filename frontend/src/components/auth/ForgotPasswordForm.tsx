import { useState, type FormEvent } from 'react';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

interface Props {
  onSendCode: (email: string) => Promise<void>;
  onReset: (email: string, code: string, newPassword: string) => Promise<void>;
  onBack: () => void;
  error: string;
}

type Step = 'email' | 'code' | 'reset';

export default function ForgotPasswordForm({ onSendCode, onReset, onBack, error }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    if (!email) { setLocalError('请输入邮箱'); return; }
    setSubmitting(true);
    setLocalError('');
    try {
      await onSendCode(email);
      setStep('code');
    } catch {
      setLocalError('发送失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (!email || !code || !newPassword) { setLocalError('请填写完整信息'); return; }
    if (newPassword !== confirmPassword) { setLocalError('两次密码输入不一致'); return; }
    setSubmitting(true);
    setLocalError('');
    try {
      await onReset(email, code, newPassword);
      setStep('reset');
    } catch (err: unknown) {
      setLocalError((err as { message?: string })?.message || '重置失败');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--da-border)',
    background: 'var(--da-bg-secondary)',
    color: 'var(--da-text-primary)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 12,
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 0',
    borderRadius: 8,
    border: 'none',
    background: 'var(--da-accent)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: submitting ? 'default' : 'pointer',
    opacity: submitting ? 0.6 : 1,
  };

  if (step === 'reset') {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>密码已重置</p>
        <p style={{ fontSize: 13, color: 'var(--da-text-tertiary)', margin: '0 0 20px' }}>
          请使用新密码重新登录
        </p>
        <button onClick={onBack} style={btnStyle}>
          返回登录
        </button>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={handleReset}>
        <p style={{ fontSize: 13, color: 'var(--da-text-tertiary)', marginBottom: 16 }}>
          验证码已发送至 {email}
        </p>
        <input
          type="text"
          inputMode="numeric"
          placeholder="验证码"
          value={code}
          onChange={(e) => setCode(e.target.value.slice(0, 6))}
          style={inputStyle}
          autoComplete="one-time-code"
        />
        <input
          type="password"
          placeholder="新密码 (至少8位)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={inputStyle}
        />
        <PasswordStrengthIndicator password={newPassword} validated={true} />
        <input
          type="password"
          placeholder="确认新密码"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{ ...inputStyle, marginTop: 12 }}
        />
        {(localError || error) && (
          <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--da-error)' }}>
            {localError || error}
          </p>
        )}
        <button type="submit" disabled={submitting} style={btnStyle}>
          {submitting ? '重置中...' : '重置密码'}
        </button>
        <button type="button" onClick={() => setStep('email')} style={{
          display: 'block', margin: '12px auto 0', background: 'none', border: 'none',
          color: 'var(--da-text-tertiary)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline',
        }}>
          返回
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode}>
      <p style={{ fontSize: 13, color: 'var(--da-text-tertiary)', marginBottom: 16 }}>
        输入注册邮箱，我们将发送验证码
      </p>
      <input
        type="email"
        placeholder="邮箱地址"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
        autoComplete="email"
      />
      {(localError || error) && (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--da-error)' }}>
          {localError || error}
        </p>
      )}
      <button type="submit" disabled={submitting} style={btnStyle}>
        {submitting ? '发送中...' : '发送验证码'}
      </button>
      <button type="button" onClick={onBack} style={{
        display: 'block', margin: '12px auto 0', background: 'none', border: 'none',
        color: 'var(--da-text-tertiary)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline',
      }}>
        返回登录
      </button>
    </form>
  );
}
