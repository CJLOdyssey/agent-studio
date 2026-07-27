import { useState, type FormEvent } from 'react';
import { X, Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth, type AuthModalView } from './AuthContext';
import ForgotPasswordForm from './ForgotPasswordForm';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

interface Props {
  onClose: () => void;
}

const inputBase = 'w-full pl-9 pr-10 py-[10px] rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] text-sm outline-none box-border transition-[border-color,box-shadow] duration-200';

const iconBase: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: 'var(--color-text-tertiary)',
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

  function inputDynamicStyle(field: string): React.CSSProperties {
    return {
      borderColor: focusedField === field ? 'var(--color-accent)' : 'var(--color-border)',
      boxShadow: focusedField === field ? '0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent)' : 'none',
    };
  }

  if (view === 'forgot' || view === 'reset') {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose} style={{ animation: 'fadeIn 0.15s ease' }}>
        <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]" style={{ maxWidth: 400, padding: 0, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]" style={{ justifyContent: 'center', position: 'relative' }}>
            <h3 className="m-0 text-lg font-bold">重置密码</h3>
<button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label="关闭" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
            <X size={18} />
          </button>
          </div>
          <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col" style={{ padding: 24 }}>
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
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose} style={{ animation: 'fadeIn 0.15s ease' }}>
      <div
        className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]"
        style={{ maxWidth: 400, padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center pt-[28px] pb-1">
          <span className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            ✦ AgentStudio
          </span>
        </div>
        <div className="flex gap-1 mx-6 mt-4 mb-0 bg-[var(--color-surface-overlay)] rounded-[var(--radius-card)] p-[3px]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => switchView(t.key)}
              className="flex-1 py-2 border-none rounded-[var(--radius-btn)] text-sm cursor-pointer transition-all duration-200"
              style={{
                background: view === t.key ? 'var(--color-surface-raised)' : 'transparent',
                color: view === t.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                fontWeight: view === t.key ? 600 : 400,
                boxShadow: view === t.key ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col" style={{ padding: '20px 24px 24px' }}>
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
                    className={inputBase}
                    style={inputDynamicStyle('email')}
                    autoComplete="email"
                  />
                </div>

                <div className="mb-4">
                  <div style={{ position: 'relative' }}>
                    <Lock style={iconBase} size={16} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => { setFocusedField(null); setPasswordTouched(true); }}
                      className={inputBase}
                      style={inputDynamicStyle('password')}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--color-text-tertiary)',
                        cursor: 'pointer', padding: 0, display: 'flex',
                      }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password && !passwordTouched && (
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-1 opacity-60">
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
                    className={inputBase}
                    style={inputDynamicStyle('confirm')}
                    autoComplete="new-password"
                  />
                  {confirmPassword && passwordTouched && confirmPassword !== password && (
                    <div className="text-xs text-[var(--color-danger)] mt-1">
                      ○ 与密码不一致
                    </div>
                  )}
                </div>

                <PasswordStrengthIndicator password={password} validated={passwordTouched} />

                <div className="flex gap-2 items-start mb-3">
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
                      className={inputBase}
                      style={inputDynamicStyle('code')}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={submitting || codeCooldown > 0}
                    className="h-10 px-3.5 rounded-[var(--radius-btn)] border text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200"
                    style={{
                      borderColor: codeCooldown > 0 ? 'var(--color-border)' : 'var(--color-accent)',
                      background: codeCooldown > 0 ? 'var(--color-surface-raised)' : 'transparent',
                      color: codeCooldown > 0 ? 'var(--color-text-tertiary)' : 'var(--color-accent)',
                      cursor: codeCooldown > 0 ? 'default' : 'pointer',
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
                    className={inputBase}
                    style={inputDynamicStyle('email')}
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
                    className={inputBase}
                    style={inputDynamicStyle('password')}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--color-text-tertiary)',
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
              <div
                className="px-3 py-2 rounded-[var(--radius-btn)] text-[var(--color-danger)] text-sm mb-3 leading-snug"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-[11px] rounded-[var(--radius-btn)] border-none text-white text-base font-semibold flex items-center justify-center gap-2 transition-all duration-150"
              style={{
                background: submitting ? 'var(--color-border)' : 'var(--color-accent)',
                color: submitting ? 'var(--color-text-tertiary)' : '#fff',
                cursor: submitting ? 'default' : 'pointer',
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
              className="block mx-auto mt-3.5 bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer text-sm p-0 transition-colors duration-150"
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--color-accent)'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = 'var(--color-text-tertiary)'}
            >
              忘记密码？
            </button>
          )}

          {/* Divider + social login (reserved) */}
          {!isRegister && (
            <div className="mt-5">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-text-tertiary)] shrink-0">或</span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
              <div className="flex justify-center gap-3 mt-3.5">
                {[
                  { label: 'QQ', color: '#07c160' },
                  { label: '微信', color: '#07c160' },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    disabled
                    className="w-11 h-11 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-tertiary)] text-xs font-semibold cursor-not-allowed opacity-40 transition-all duration-200"
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
