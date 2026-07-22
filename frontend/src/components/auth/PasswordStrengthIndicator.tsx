interface Props {
  password: string;
  validated: boolean;
}

const SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?~";

interface Check {
  label: string;
  pass: boolean;
}

function checks(password: string): Check[] {
  const common = new Set([
    "password", "password123", "admin123", "admin888",
    "12345678", "qwerty123", "letmein", "welcome",
    "monkey", "dragon", "passw0rd", "abc123",
    "123456789", "iloveyou", "trustno1", "sunshine",
    "master", "access", "shadow", "michael",
  ]);
  return [
    { label: '至少 8 位', pass: password.length >= 8 },
    { label: '数字', pass: /\d/.test(password) },
    { label: '小写', pass: /[a-z]/.test(password) },
    { label: '大写', pass: /[A-Z]/.test(password) },
    { label: '特殊字符', pass: [...password].some(c => SPECIAL_CHARS.includes(c)) },
    { label: '非常见密码', pass: !common.has(password.toLowerCase()) },
  ];
}

export default function PasswordStrengthIndicator({ password, validated }: Props) {
  if (!password) return null;

  const items = checks(password);
  const passed = items.filter(c => c.pass).length;
  const total = items.length;
  const failed = items.filter(c => !c.pass);

  return (
    <div style={{ marginTop: 6, marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {items.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: c.pass ? 'var(--da-success)' : 'var(--da-border)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>

      {validated && failed.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--da-text-tertiary)', lineHeight: 1.6 }}>
          {failed.map((c, i) => (
            <span key={i}>
              {i > 0 && ' · '}○ {c.label}
            </span>
          ))}
        </div>
      )}

      {validated && passed === total && (
        <div style={{ fontSize: 11, color: 'var(--da-success)' }}>
          全部满足 ✓
        </div>
      )}
    </div>
  );
}
