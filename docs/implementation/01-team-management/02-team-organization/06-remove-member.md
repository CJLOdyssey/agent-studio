---
version: v1.1.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：移除成员

> 子域：团队组织管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望从团队中移除成员。

---

## 验收标准

- [ ] 移除成功返回 deleted
- [ ] 不存在返回 404

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_team.py`

```python
async def test_remove_member_success():
    team_id = await create_test_team()
    member_id = await add_test_member(team_id)
    response = await client.delete(f"/api/teams/{team_id}/members/{member_id}")
    assert response.status_code == 200

async def test_remove_member_not_found():
    team_id = await create_test_team()
    response = await client.delete(f"/api/teams/{team_id}/members/nonexistent")
    assert response.status_code == 404
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/teams.py`

```python
async def remove_member(team_id: str, member_id: str) -> bool:
    result = await db.execute(
        delete(TeamMemberDB).where(
            TeamMemberDB.id == member_id,
            TeamMemberDB.team_id == team_id
        )
    )
    await db.commit()
    return result.rowcount > 0
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

---

## 测试覆盖率

**目标**：该功能相关代码测试覆盖率 ≥ 80%

**测试命令**：
```bash
# 后端
pytest tests/test_*.py -v --cov=virtual_team/routers/ --cov=virtual_team/repository/

# 前端（如有）
npm run test:coverage
```

**覆盖率报告**：
- 终端输出：显示行覆盖率百分比
- HTML 报告：`frontend/coverage/`（前端）或 `htmlcov/`（后端）

**验收标准**：
- [ ] 所有测试用例通过
- [ ] 覆盖率 ≥ 80%
- [ ] 关键路径 100% 覆盖

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
| v1.1.0 | 2026-06-06 | Sisyphus | 添加测试覆盖率要求 |
