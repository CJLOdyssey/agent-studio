# 6. 认证与用户

> 用户管理、登录注册、密码体系、权限控制。

---

## 架构树

```
6. 认证与用户
├── 6.1 登录
│   ├── 功能：邮箱密码登录 / Token 刷新 / 登出
│   ├── FE: LoginModal（登录 Tab）
│   ├── BE: auth/login.py → repository/auth.py
│   └── DB: users, refresh_tokens
│
├── 6.2 注册
│   ├── 功能：发送验证码 / 注册 / 邮箱验证 / 重新发送
│   ├── FE: LoginModal（注册 Tab）
│   ├── BE: auth/register.py → repository/auth.py
│   └── DB: users, Redis
│
├── 6.3 密码管理
│   ├── 功能：忘记密码 / 重置密码 / 修改密码
│   ├── FE: ForgotPasswordForm
│   ├── BE: auth/password.py → repository/auth.py
│   └── DB: users, Redis
│
├── 6.4 用户信息与状态
│   ├── 功能：GET /me / Auth 配置 / 访客合并 / 用户菜单
│   ├── FE: AuthContext, UserMenu, PasswordStrengthIndicator
│   ├── BE: auth/profile.py → repository/auth.py
│   └── DB: users, user_roles, roles
│
└── 6.5 权限控制
    ├── 功能：JWT 签发校验 / RBAC 中间件 / 路由豁免 / AuthMiddleware
    └── BE: auth/auth_jwt.py, auth/auth_middleware.py, auth/auth_rbac.py
```

---

## 6.1 登录

| 项目 | 内容 |
|------|------|
| **功能** | 邮箱密码登录 |
| | Token 自动刷新（httpOnly cookie + refresh_token） |
| | 登出（清除 cookie + refresh_token + 本地对话） |
| **前端** | LoginModal（登录 Tab） |
| **后端** | `auth/login.py` → `repository/auth.py` |
| **ORM** | `UserDB` → `users`, `RefreshTokenDB` → `refresh_tokens` |
| **状态** | ✅ |

## 6.2 注册

| 项目 | 内容 |
|------|------|
| **功能** | 发送验证码（Redis 存储） |
| | 注册（密码 bcrypt 加密） |
| | 邮箱验证码验证 |
| | 重新发送验证码 |
| **前端** | LoginModal（注册 Tab） |
| **后端** | `auth/register.py` → `repository/auth.py` |
| **ORM** | `UserDB` → `users`, Redis |
| **状态** | ✅ |

## 6.3 密码管理

| 项目 | 内容 |
|------|------|
| **功能** | 忘记密码（发送重置码） |
| | 重置密码（验证码 + 新密码） |
| | 修改密码（需旧密码验证） |
| **前端** | ForgotPasswordForm |
| **后端** | `auth/password.py` → `repository/auth.py` |
| **ORM** | `UserDB` → `users`, Redis |
| **状态** | ✅ |

## 6.4 用户信息与状态

| 项目 | 内容 |
|------|------|
| **功能** | 获取当前用户 `GET /me` |
| | Auth 配置（模式 / 启用状态） |
| | 访客数据合并（merge guest → user） |
| | 用户菜单（游客 / 登录状态切换） |
| **前端** | AuthContext, UserMenu, PasswordStrengthIndicator |
| **后端** | `auth/profile.py` → `repository/auth.py` |
| **ORM** | `UserDB` → `users`, `UserRoleDB` → `user_roles`, `RoleDB` → `roles` |
| **状态** | ✅ |

## 6.5 权限控制

| 项目 | 内容 |
|------|------|
| **功能** | JWT 签发与校验（HS256） |
| | RBAC 角色中间件 |
| | 公开路由豁免（health / auth / ws） |
| | AuthMiddleware（Bearer token / cookie / query param） |
| **后端** | `auth/auth_jwt.py`, `auth/auth_middleware.py`, `auth/auth_rbac.py` |
| **状态** | ✅ |
