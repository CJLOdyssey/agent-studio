---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：查询团队列表

> 子域：团队组织管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望查看我创建的所有团队。

---

## 验收标准

- [ ] 返回当前用户所有团队
- [ ] 按 order 字段排序
- [ ] 空列表返回空数组

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_team.py`

```python
async def test_list_teams_empty():
    response = await client.get("/api/teams")
    assert response.status_code == 200
    assert response.json() == []

async def test_list_teams_with_data():
    await client.post("/api/teams", json={"name": "团队1"})
    await client.post("/api/teams", json={"name": "团队2"})
    response = await client.get("/api/teams")
    assert len(response.json()) == 2
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/teams.py`

```python
async def get_teams(user_id: str) -> list[TeamDB]:
    result = await db.execute(
        select(TeamDB).where(TeamDB.user_id == user_id).order_by(TeamDB.order)
    )
    return result.scalars().all()
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_team.py` |
| Repository | `virtual_team/repository/teams.py` |
| API | `virtual_team/routers/teams.py` |

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
