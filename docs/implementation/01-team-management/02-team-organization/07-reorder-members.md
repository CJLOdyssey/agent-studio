---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：成员排序

> 子域：团队组织管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望调整团队成员的顺序。

---

## 验收标准

- [ ] 批量更新排序
- [ ] 排序持久化

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_team.py`

```python
async def test_reorder_members():
    team_id = await create_test_team()
    m1 = await add_test_member(team_id, "成员1")
    m2 = await add_test_member(team_id, "成员2")
    
    response = await client.put(f"/api/teams/{team_id}/members/reorder", json={
        "member_ids": [m2, m1]
    })
    assert response.status_code == 200
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/teams.py`

```python
async def reorder_members(team_id: str, member_ids: list[str]):
    for idx, member_id in enumerate(member_ids):
        await db.execute(
            update(TeamMemberDB)
            .where(TeamMemberDB.id == member_id)
            .values(order=idx)
        )
    await db.commit()
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
