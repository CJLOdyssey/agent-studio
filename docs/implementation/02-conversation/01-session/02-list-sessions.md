---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：查询会话列表

> 子域：会话管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望查看我的所有会话。

---

## 验收标准

- [ ] 返回当前用户所有会话
- [ ] 按创建时间倒序
- [ ] 包含标题和最后更新时间

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_session.py`

```python
async def test_list_sessions_empty():
    response = await client.get("/api/sessions")
    assert response.status_code == 200
    assert response.json() == []

async def test_list_sessions_with_data():
    await client.post("/api/sessions", json={"title": "会话1"})
    await client.post("/api/sessions", json={"title": "会话2"})
    response = await client.get("/api/sessions")
    assert len(response.json()) == 2
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/sessions.py`

```python
async def get_sessions(user_id: str) -> list[SessionDB]:
    result = await db.execute(
        select(SessionDB)
        .where(SessionDB.user_id == user_id)
        .order_by(SessionDB.created_at.desc())
    )
    return result.scalars().all()
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_session.py` |
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
