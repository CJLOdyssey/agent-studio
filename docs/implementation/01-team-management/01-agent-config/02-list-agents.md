---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：查询 Agent 列表

> 子域：Agent 配置管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为团队管理员，我希望查看团队下所有 Agent 的列表，以便了解团队配置情况。

---

## 验收标准

- [ ] 返回当前团队所有 Agent
- [ ] 按 order 字段排序
- [ ] 包含基础信息（名称、角色、图标、状态）
- [ ] 空列表返回空数组

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_agent.py`

```python
async def test_list_agents_empty():
    """空团队返回空列表"""
    response = await client.get("/api/agents")
    assert response.status_code == 200
    assert response.json() == []

async def test_list_agents_with_data():
    """返回 Agent 列表"""
    # 先创建 2 个 Agent
    await client.post("/api/agents", json={...})
    await client.post("/api/agents", json={...})
    
    response = await client.get("/api/agents")
    assert response.status_code == 200
    assert len(response.json()) == 2
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/agents.py`

```python
async def get_agents(team_id: str) -> list[AgentDB]:
    result = await db.execute(
        select(AgentDB)
        .where(AgentDB.team_id == team_id)
        .order_by(AgentDB.order)
    )
    return result.scalars().all()
```

**文件**: `virtual_team/routers/agents.py`

```python
@router.get("/api/agents")
async def list_agents():
    agents = await get_agents_service(...)
    return [...]
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_agent.py` |
| Repository | `virtual_team/repository/agents.py` |
| API | `virtual_team/routers/agents.py` |

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
