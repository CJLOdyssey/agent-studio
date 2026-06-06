---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：删除会话

> 子域：会话管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望删除不需要的会话。

---

## 验收标准

- [ ] 删除成功返回 deleted
- [ ] 不存在返回 404
- [ ] 级联删除消息和记忆

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_session.py`

```python
async def test_delete_session_success():
    create_resp = await client.post("/api/sessions", json={"title": "测试"})
    session_id = create_resp.json()["id"]
    response = await client.delete(f"/api/sessions/{session_id}")
    assert response.status_code == 200

async def test_delete_session_not_found():
    response = await client.delete("/api/sessions/nonexistent")
    assert response.status_code == 404
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/sessions.py`

```python
async def delete_session(session_id: str) -> bool:
    session = await get_session_by_id(session_id)
    if not session:
        return False
    await db.delete(session)
    await db.commit()
    return True
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
