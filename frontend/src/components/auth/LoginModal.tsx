import { useState, type FormEvent } from 'react';
import { X, Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth, type AuthModalView } from './AuthContext';
import ForgotPasswordForm from './ForgotPasswordForm';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

interface Props {
  onClose: () => void;
}

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '10px 40px 10px 36px',
  borderRadius: 8,
  border: '1px solid var(--da-border)',
  background: 'var(--da-bg-secondary)',
  color: 'var(--da-text-primary)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const iconBase: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: 'var(--da-text-tertiary)',
  width: 16,
  height: 16,
};

export default function LoginModal({ onClose }: Props) {
  const {
    loginModalView: view,
    login,
    register,
    forgotPassword,
    resetPassword,
    sendRegisterCode,
    setLoginModalView: setView,
    setLoginModalEmail: setEmail,
    closeLoginModal,
  } = useAuth();

  const [email, setLocalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const tabs: { key: AuthModalView; label: string }[] = [
    { key: 'login', label: '登录' },
    { key: 'register', label: '注册' },
  ];

  function switchView(v: AuthModalView) {
    setError('');
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setCodeCooldown(0);
    setPasswordTouched(false);
    setView(v);
  }

  async function handleSendCode() {
    if (!email) { setError('请先输入邮箱'); return; }
    if (codeCooldown > 0) return;
    setError('');
    setSubmitting(true);
    try {
      await sendRegisterCode(email);
      setCodeCooldown(60);
      const id = setInterval(() => {
        setCodeCooldown((c) => {
          if (c <= 1) { clearInterval(id); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || '发送失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister() {
    setError('');
    if (!password) { setError('请输入密码'); return; }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return; }
    if (!email) { setError('请输入邮箱'); return; }
    if (!code) { setError('请输入验证码'); return; }
    setSubmitting(true);
    try {
      await register(email, code, password);
      closeLoginModal();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || '注册失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin() {
    setError('');
    if (!email) { setError('请输入邮箱'); return; }
    if (!password) { setError('请输入密码'); return; }
    setSubmitting(true);
    try {
      await login(email, password);
      closeLoginModal();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (view === 'register') {
      await handleRegister();
    } else {
      await handleLogin();
    }
  }

  function inputStyle(field: string): React.CSSProperties {
    return {
      ...inputBase,
      borderColor: focusedField === field ? 'var(--da-accent)' : 'var(--da-border)',
      boxShadow: focusedField === field ? '0 0 0 2px color-mix(in srgb, var(--da-accent) 20%, transparent)' : 'none',
    };
  }

  if (view === 'forgot' || view === 'reset') {
    return (
      <div className="modal-overlay" onClick={onClose} style={{ animation: 'fadeIn 0.15s ease' }}>
        <div className="modal-content" style={{ maxWidth: 400, padding: 0, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}>
          <div className="modal-header" style={{ justifyContent: 'center', position: 'relative' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>重置密码</h3>
            <button className="modal-close" onClick={onClose} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
              <X size={18} />
            </button>
          </div>
          <div className="modal-body" style={{ padding: 24 }}>
            <ForgotPasswordForm
              onSendCode={async (email) => { await forgotPassword(email); setEmail(email); }}
              onReset={async (email, code, newPassword) => { await resetPassword(email, code, newPassword); switchView('login'); }}
              onBack={() => switchView('login')}
              error={error}
            />
          </div>
        </div>
      </div>
    );
  }

  const isRegister = view === 'register';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ animation: 'fadeIn 0.15s ease' }}>
      <div
        className="modal-content"
        style={{ maxWidth: 400, padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', paddingTop: 28, paddingBottom: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--da-text-primary)' }}>
            ✦ AgentStudio
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, margin: '16px 24px 0', background: 'var(--da-bg-tertiary)', borderRadius: 10, padding: 3 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => switchView(t.key)}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 8,
                background: view === t.key ? 'var(--da-bg-secondary)' : 'transparent',
                color: view === t.key ? 'var(--da-text-primary)' : 'var(--da-text-tertiary)',
                fontWeight: view === t.key ? 600 : 400,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: view === t.key ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ padding: '20px 24px 24px' }}>
          <form onSubmit={handleSubmit}>
            {isRegister ? (
              <>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Mail style={iconBase} size={16} />
                  <input
                    type="email"
                    placeholder="邮箱地址"
                    value={email}
                    onChange={(e) => setLocalEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle('email')}
                    autoComplete="email"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ position: 'relative' }}>
                    <Lock style={iconBase} size={16} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => { setFocusedField(null); setPasswordTouched(true); }}
                      style={inputStyle('password')}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--da-text-tertiary)',
                        cursor: 'pointer', padding: 0, display: 'flex',
                      }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password && !passwordTouched && (
                    <div style={{ fontSize: 11, color: 'var(--da-text-tertiary)', marginTop: 4, opacity: 0.6 }}>
                      至少8位 · 数字 · 小写 · 大写 · 特殊字符
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <Lock style={iconBase} size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="确认密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => { setFocusedField(null); setPasswordTouched(true); }}
                    style={inputStyle('confirm')}
                    autoComplete="new-password"
                  />
                  {confirmPassword && passwordTouched && confirmPassword !== password && (
                    <div style={{ fontSize: 11, color: 'var(--da-error)', marginTop: 4 }}>
                      ○ 与密码不一致
                    </div>
                  )}
                </div>

                <PasswordStrengthIndicator password={password} validated={passwordTouched} />

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <ShieldCheck style={iconBase} size={16} />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="验证码"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onFocus={() => setFocusedField('code')}
                      onBlur={() => setFocusedField(null)}
                      style={inputStyle('code')}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={submitting || codeCooldown > 0}
                    style={{
                      height: 40,
                      padding: '0 14px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: codeCooldown > 0 ? 'var(--da-border)' : 'var(--da-accent)',
                      background: codeCooldown > 0 ? 'var(--da-bg-secondary)' : 'transparent',
                      color: codeCooldown > 0 ? 'var(--da-text-tertiary)' : 'var(--da-accent)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: codeCooldown > 0 ? 'default' : 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                    }}
                  >
                    {codeCooldown > 0 ? `${codeCooldown}s` : '获取验证码'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Mail style={iconBase} size={16} />
                  <input
                    type="email"
                    placeholder="邮箱地址"
                    value={email}
                    onChange={(e) => setLocalEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle('email')}
                    autoComplete="email"
                  />
                </div>

                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Lock style={iconBase} size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle('password')}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--da-text-tertiary)',
                      cursor: 'pointer', padding: 0, display: 'flex',
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </>
            )}

            {error && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'color-mix(in srgb, var(--da-error) 10%, transparent)',
                color: 'var(--da-error)',
                fontSize: 13,
                marginBottom: 12,
                lineHeight: 1.4,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '11px 0',
                borderRadius: 8,
                border: 'none',
                background: submitting ? 'var(--da-border)' : 'var(--da-accent)',
                color: submitting ? 'var(--da-text-tertiary)' : '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: submitting ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (!submitting) (e.target as HTMLElement).style.opacity = '0.9'; }}
              onMouseLeave={(e) => { if (!submitting) (e.target as HTMLElement).style.opacity = '1'; }}
            >
              {submitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {isRegister ? '注册' : '登录'}
            </button>
          </form>

          {!isRegister && (
            <button
              type="button"
              onClick={() => switchView('forgot')}
              style={{
                display: 'block',
                margin: '14px auto 0',
                background: 'none',
                border: 'none',
                color: 'var(--da-text-tertiary)',
                cursor: 'pointer',
                fontSize: 13,
                padding: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--da-accent)'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = 'var(--da-text-tertiary)'}
            >
              忘记密码？
            </button>
          )}

          {/* Divider + social login (reserved) */}
          {!isRegister && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--da-border)' }} />
                <span style={{ fontSize: 12, color: 'var(--da-text-tertiary)', flexShrink: 0 }}>或</span>
                <div style={{ flex: 1, height: 1, background: 'var(--da-border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 14 }}>
                {[
                  { label: 'QQ', color: '#07c160' },
                  { label: '微信', color: '#07c160' },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    disabled
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      border: '1px solid var(--da-border)',
                      background: 'var(--da-bg-secondary)',
                      color: 'var(--da-text-tertiary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'not-allowed',
                      opacity: 0.4,
                      transition: 'all 0.2s',
                    }}
                    title={`${p.label}登录（即将支持）`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
