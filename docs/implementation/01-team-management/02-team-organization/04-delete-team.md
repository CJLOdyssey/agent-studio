---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：删除团队

> 子域：团队组织管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望删除不需要的团队。

---

## 验收标准

- [ ] 删除成功返回 deleted
- [ ] 不存在返回 404
- [ ] 级联删除成员和 Agent

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_team.py`

```python
async def test_delete_team_success():
    create_resp = await client.post("/api/teams", json={"name": "测试团队"})
    team_id = create_resp.json()["id"]
    response = await client.delete(f"/api/teams/{team_id}")
    assert response.status_code == 200

async def test_delete_team_not_found():
    response = await client.delete("/api/teams/nonexistent")
    assert response.status_code == 404
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/teams.py`

```python
async def delete_team(team_id: str) -> bool:
    team = await get_team_by_id(team_id)
    if not team:
        return False
    await db.delete(team)
    await db.commit()
    return True
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
