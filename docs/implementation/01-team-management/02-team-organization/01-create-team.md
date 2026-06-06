---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：创建团队

> 子域：团队组织管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望创建一个新团队，以便组织我的虚拟开发团队。

---

## 验收标准

- [ ] 输入团队名称创建成功
- [ ] 返回团队 ID
- [ ] 重复名称返回 409

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_team.py`

```python
async def test_create_team_success():
    response = await client.post("/api/teams", json={"name": "开发团队"})
    assert response.status_code == 201
    assert "id" in response.json()

async def test_create_team_duplicate_name():
    await client.post("/api/teams", json={"name": "开发团队"})
    response = await client.post("/api/teams", json={"name": "开发团队"})
    assert response.status_code == 409
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/teams.py`

```python
async def create_team(user_id: str, name: str) -> TeamDB:
    team = TeamDB(id=str(uuid4()), user_id=user_id, name=name)
    db.add(team)
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
| 数据库 | `virtual_team/database.py` (TeamDB) |
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
