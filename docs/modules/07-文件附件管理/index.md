# 07 文件附件管理

## 业务闭环

```
选择文件 → 上传验证 → 存储到 uploads/ → 关联到 Run → Agent 读取 → 处理完成
```

## 层级实现

| 层级 | 实现 |
|---|---|
| **前端组件** | `AttachmentsDrawer` (附件管理抽屉) |
| **前端 Hook** | `useAttachments` (附件上传/下载/删除) |
| **后端路由** | `attachments.py` (上传/下载/删除) |
| **数据库表** | `attachments` |
| **存储** | `uploads/` 目录 |

## 数据流

```
用户选择文件
    │
    ▼
POST /api/attachments
    │
    ├── 验证文件类型 (PDF/TXT/MD/PY/JS/TS/JSON/YAML)
    ├── 验证文件大小 (max 50MB)
    │
    ▼
存储到 uploads/{user_id}/{filename}
    │
    ▼
保存元数据到 attachments 表
    │
    ▼
Agent 执行时读取文件内容
    │
    ▼
注入到 Prompt → Agent 处理
```

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/attachments` | 上传附件 |
| GET | `/api/attachments` | 列出附件 |
| GET | `/api/attachments/{id}/download` | 下载附件 |
| DELETE | `/api/attachments/{id}` | 删除附件 |

## 数据库表

```sql
CREATE TABLE attachments (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    run_id VARCHAR(36) REFERENCES project_runs(id) ON DELETE CASCADE,
    filename VARCHAR(256) NOT NULL,
    filepath VARCHAR(512) NOT NULL,
    content_type VARCHAR(128),
    file_size BIGINT,
    created_at TIMESTAMP
);
```

## 支持的文件类型

| 类型 | 扩展名 |
|---|---|
| 文档 | `.pdf`, `.txt`, `.md` |
| 代码 | `.py`, `.js`, `.ts`, `.tsx`, `.jsx` |
| 配置 | `.json`, `.yaml`, `.yml`, `.toml` |
