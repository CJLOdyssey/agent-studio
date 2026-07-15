import { useState, useEffect, useRef, type FormEvent } from 'react';

interface Props {
  email: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  error: string;
}

export default function VerifyCodeForm({ email, onVerify, onResend, onBack, error }: Props) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleDigit(idx: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[idx] = value.slice(-1);
    setCode(next);
    if (value && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    await onVerify(code.join(''));
  }

  async function handleResend() {
    setCooldown(60);
    await onResend();
    setCode(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  }

  return (
    <form onSubmit={handleVerify}>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--da-text-tertiary)' }}>
        验证码已发送至
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: 'var(--da-text-primary)' }}>
        {email}
      </p>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            autoComplete="one-time-code"
            style={{
              width: 42,
              height: 48,
              textAlign: 'center',
              fontSize: 20,
              fontWeight: 600,
              borderRadius: 8,
              border: `2px solid ${d ? 'var(--da-accent)' : 'var(--da-border)'}`,
              background: 'var(--da-bg-secondary)',
              color: 'var(--da-text-primary)',
              outline: 'none',
            }}
          />
        ))}
      </div>

      {error && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--da-error)', textAlign: 'center' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={code.join('').length !== 6}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: 'none',
          background: code.join('').length === 6 ? 'var(--da-accent)' : 'var(--da-border)',
          color: code.join('').length === 6 ? '#fff' : 'var(--da-text-tertiary)',
          fontSize: 15,
          fontWeight: 600,
          cursor: code.join('').length === 6 ? 'pointer' : 'default',
        }}
      >
        验证
      </button>

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>
        {cooldown > 0 ? (
          <span style={{ color: 'var(--da-text-tertiary)' }}>
            重新发送 ({cooldown}s)
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--da-accent)',
              cursor: 'pointer',
              fontSize: 13,
              padding: 0,
            }}
          >
            重新发送验证码
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'block',
          margin: '12px auto 0',
          background: 'none',
          border: 'none',
          color: 'var(--da-text-tertiary)',
          cursor: 'pointer',
          fontSize: 13,
          textDecoration: 'underline',
        }}
      >
        返回
      </button>
    </form>
  );
}
