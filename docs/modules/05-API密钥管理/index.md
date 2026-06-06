# 05 API 密钥管理

## 业务闭环

```
添加密钥 → 输入 API Key → 加密存储到 user_api_keys 表 → 测试连接 → 选择模型 → 调用 LLM → 使用统计
```

## 层级实现

| 层级 | 实现 |
|---|---|
| **前端组件** | `AgentConfigModal` (密钥选择) |
| **前端 Hook** | `useApiKeys` (密钥管理) |
| **后端路由** | `keys.py` (CRUD + 加密) |
| **数据库表** | `user_api_keys` |
| **加密** | AES-256-GCM (Fernet) |

## 数据流

```
用户输入 API Key
    │
    ▼
前端加密 (useApiKeys.encryptKey)
    │
    ▼
POST /api/user_api_keys
    │
    ▼
后端解密 → 测试连接 (验证 Key 有效性)
    │
    ├── 有效 ──▶ AES 加密存储到 user_api_keys 表
    └── 无效 ──▶ 返回错误
    │
    ▼
选择密钥 → 绑定到 Agent 配置 → 调用 LLM
```

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/user_api_keys` | 列出密钥（脱敏） |
| POST | `/api/user_api_keys` | 添加密钥 |
| PUT | `/api/user_api_keys/{id}` | 更新密钥 |
| DELETE | `/api/user_api_keys/{id}` | 删除密钥 |
| POST | `/api/user_api_keys/{id}/test` | 测试连接 |

## 数据库表

```sql
CREATE TABLE user_api_keys (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    api_key_masked VARCHAR(64) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    base_url VARCHAR(256),
    is_valid BOOLEAN DEFAULT TRUE,
    last_validated_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```
