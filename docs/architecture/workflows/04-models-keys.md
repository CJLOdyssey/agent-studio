# 4. 模型与密钥

> 用户在此配置 API 密钥、管理可用模型。

---

## 架构树

```
4. 模型与密钥
├── 4.1 API 密钥管理
│   ├── 功能：密钥 CRUD / Fernet 加密 / 掩码 / 连通测试 / 用量统计 / 拉取模型 / 匿名回落
│   ├── FE: ApiManagementModal, ApiProviderTab, ApiUsageTab, ProviderEditModal
│   ├── BE: routers/keys.py → repository/keys_crud.py
│   └── DB: user_api_keys, key_usage_logs
│
└── 4.2 模型管理
    ├── 功能：可用模型列表 / 模型选择 / localStorage 持久化
    ├── FE: ModelSelector（输入框 + 弹窗）
    ├── BE: routers/models.py → repository/keys_crud.py
    └── DB: user_api_keys.models 字段
```

---

## 4.1 API 密钥管理

| 项目 | 内容 |
|------|------|
| **功能** | 密钥 CRUD（列表/创建/编辑/删除） |
| | 加密存储（Fernet key_vault） |
| | 掩码显示（仅显示首尾字符） |
| | 连通性测试 `POST /keys/{id}/test` |
| | 用量统计（今日/本月 tokens） |
| | 拉取可用模型 `POST /keys/fetch-models` |
| | 匿名用户回落（get_api_keys fallback） |
| **前端** | ApiManagementModal, ApiProviderTab, ApiUsageTab |
| | ProviderEditModal, ConnectionTest, CredentialsSection |
| **后端** | `routers/keys.py` → `repository/keys_crud.py` |
| | `core/infra/key_vault.py`（Fernet 加密） |
| **ORM** | `UserApiKey` → `user_api_keys`, `KeyUsageLog` → `key_usage_logs` |
| **状态** | ✅ |

## 4.2 模型管理

| 项目 | 内容 |
|------|------|
| **功能** | 可用模型列表（从密钥+服务端获取） |
| | 模型选择（输入框下拉） |
| | 已选择模型 localStorage 持久化 |
| | fallback 模型列表（硬编码） |
| **前端** | ModelSelector（输入框）, ModelSelector（弹窗） |
| **后端** | `routers/models.py` → `repository/keys_crud.py` |
| **ORM** | `user_api_keys`（models 字段） |
| **状态** | ✅ |
