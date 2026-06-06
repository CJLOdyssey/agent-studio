---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：更新团队

> 子域：团队组织管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望修改团队名称和排序。

---

## 验收标准

- [ ] 更新团队名称
- [ ] 更新排序
- [ ] 不存在返回 404

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_team.py`

```python
async def test_update_team_success():
    create_resp = await client.post("/api/teams", json={"name": "旧名称"})
    team_id = create_resp.json()["id"]
    response = await client.put(f"/api/teams/{team_id}", json={"name": "新名称"})
    assert response.status_code == 200

async def test_update_team_not_found():
    response = await client.put("/api/teams/nonexistent", json={"name": "新名称"})
    assert response.status_code == 404
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/teams.py`

```python
async def update_team(team_id: str, **kwargs) -> TeamDB | None:
    team = await get_team_by_id(team_id)
    if not team:
        return None
    for key, value in kwargs.items():
        if value is not None:
            setattr(team, key, value)
    await db.commit()
    return team
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
