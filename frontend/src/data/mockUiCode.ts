import type { FileNode } from '../types/devagents';

export const mockUiCode: FileNode = {
  id: 'ui-root',
  name: 'ui-components',
  type: 'folder',
  children: [
    {
      id: 'ui-login',
      name: 'Login.tsx',
      type: 'file',
      content: `import { useState } from 'react';\n\nexport default function Login() {\n  const [email, setEmail] = useState('');\n  const [password, setPassword] = useState('');\n  const [captcha, setCaptcha] = useState('');\n\n  const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    const res = await fetch('/api/auth/login', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ email, password, captcha })\n    });\n    if (res.ok) {\n      const data = await res.json();\n      localStorage.setItem('token', data.token);\n      window.location.href = '/dashboard';\n    }\n  };\n\n  return (\n    <div className="login-container">\n      <form onSubmit={handleSubmit} className="login-form">\n        <h2>登录</h2>\n        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="邮箱" required />\n        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="密码" required />\n        <div className="captcha-row">\n          <input type="text" value={captcha} onChange={e => setCaptcha(e.target.value)} placeholder="验证码" maxLength={6} />\n          <img src="/api/auth/captcha" alt="验证码" />\n        </div>\n        <button type="submit">登录</button>\n      </form>\n    </div>\n  );\n}`,
      language: 'tsx'
    },
    { id: 'ui-styles', name: 'login.css', type: 'file', content: '.login-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }\n.login-form { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }\n.captcha-row { display: flex; gap: 8px; align-items: center; }', language: 'css' },
    { id: 'ui-types', name: 'types.ts', type: 'file', content: 'export interface LoginForm {\n  email: string;\n  password: string;\n  captcha: string;\n}\n\nexport interface LoginResponse {\n  token: string;\n  user: { id: number; email: string; name: string };\n}', language: 'ts' },
    {
      id: 'ui-api-folder', name: 'api', type: 'folder', children: [
        { id: 'ui-api-login', name: 'login.ts', type: 'file', content: `import type { LoginForm, LoginResponse } from '../types';\n\nconst MOCK_USER = {\n  email: 'admin@example.com',\n  password: 'admin123',\n};\n\nexport async function login(data: LoginForm): Promise<LoginResponse> {\n  await new Promise(r => setTimeout(r, 800));\n  if (data.email === MOCK_USER.email && data.password === MOCK_USER.password) {\n    return { token: 'mock-jwt-token-' + Date.now(), user: { id: 1, email: data.email, name: '管理员' } };\n  }\n  throw new Error('邮箱或密码错误');\n}`, language: 'ts' },
      ]
    },
    {
      id: 'ui-hooks-folder', name: 'hooks', type: 'folder', children: [
        { id: 'ui-hooks-auth', name: 'useAuth.ts', type: 'file', content: `import { useState, useCallback } from 'react';\nimport { login } from '../api/login';\nimport type { LoginForm, LoginResponse } from '../types';\n\nexport function useAuth() {\n  const [user, setUser] = useState<LoginResponse['user'] | null>(null);\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<string | null>(null);\n\n  const handleLogin = useCallback(async (form: LoginForm) => {\n    setLoading(true);\n    setError(null);\n    try {\n      const res = await login(form);\n      setUser(res.user);\n      return res;\n    } catch (err) {\n      setError(err instanceof Error ? err.message : '登录失败');\n      throw err;\n    } finally {\n      setLoading(false);\n    }\n  }, []);\n\n  return { user, loading, error, login: handleLogin };\n}`, language: 'ts' },
      ]
    },
    {
      id: 'ui-tests', name: '__tests__', type: 'folder', children: [
        { id: 'ui-test-login', name: 'Login.test.tsx', type: 'file', content: `import { render, screen, fireEvent } from '@testing-library/react';\nimport Login from '../Login';\n\ndescribe('Login Component', () => {\n  it('renders login form', () => {\n    render(<Login />);\n    expect(screen.getByPlaceholderText('邮箱')).toBeInTheDocument();\n    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();\n    expect(screen.getByPlaceholderText('验证码')).toBeInTheDocument();\n  });\n\n  it('submits form with credentials', async () => {\n    render(<Login />);\n    fireEvent.change(screen.getByPlaceholderText('邮箱'), { target: { value: 'test@test.com' } });\n    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'password' } });\n    fireEvent.click(screen.getByText('登录'));\n  });\n});`, language: 'tsx' },
        { id: 'ui-test-api', name: 'login.api.test.ts', type: 'file', content: `import { login } from '../api/login';\n\ndescribe('Login API', () => {\n  it('returns token on valid credentials', async () => {\n    const res = await login({ email: 'admin@example.com', password: 'admin123', captcha: '1234' });\n    expect(res).toHaveProperty('token');\n  });\n\n  it('throws on invalid credentials', async () => {\n    await expect(login({ email: 'wrong', password: 'wrong', captcha: 'wrong' })).rejects.toThrow();\n  });\n});`, language: 'ts' },
      ]
    },
  ]
};
