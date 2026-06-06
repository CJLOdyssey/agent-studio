---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：创建会话

> 子域：会话管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望创建一个新会话来组织对话。

---

## 验收标准

- [ ] 创建成功返回会话 ID
- [ ] 自动设置标题为"新对话"
- [ ] 记录创建时间

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_session.py`

```python
async def test_create_session_success():
    response = await client.post("/api/sessions", json={"title": "需求讨论"})
    assert response.status_code == 201
    assert "id" in response.json()

async def test_create_session_default_title():
    response = await client.post("/api/sessions", json={})
    assert response.json()["title"] == "新对话"
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/sessions.py`

```python
async def create_session(user_id: str, title: str = "新对话") -> SessionDB:
    session = SessionDB(
        id=str(uuid4()),
        user_id=user_id,
        title=title
    )
    db.add(session)
    await db.commit()
    return session
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_session.py` |
| 数据库 | `virtual_team/database.py` (SessionDB) |
| Repository | `virtual_team/repository/sessions.py` |
| API | `virtual_team/routers/sessions.py` |

---

## 进度

| 步骤 | 状态 |
|---|---|
| 编写测试 | ⬜ |
| 测试失败 (RED) | ⬜ |
| 编写实现 | ⬜ |
| 测试通过 (GREEN) | ⬜ |
| 重构 (REFACTOR) | ⬜ |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
