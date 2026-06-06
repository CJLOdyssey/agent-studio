---
version: v1.1.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：创建 Agent

> 子域：Agent 配置管理
> 状态：✅ 已完成

---

## 用户故事

作为团队管理员，我希望能创建一个新的 Agent 并配置其基础信息，以便组建虚拟开发团队。

---

## 验收标准

- [ ] 可以输入 Agent 名称、描述、角色标识
- [ ] 可以选择图标、模型、温度
- [ ] 可以设置是否为审批者
- [ ] 创建成功后返回 Agent ID
- [ ] 重复的角色标识返回 409 错误

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_agent.py`

```python
async def test_create_agent_success():
    """创建 Agent 成功"""
    response = await client.post("/api/agents", json={
        "name": "产品经理",
        "role_identifier": "pm",
        "description": "负责需求分析和PRD输出",
        "icon": "📋",
        "model": "deepseek-v4-flash",
        "temperature": 0.7,
        "is_approver": False
    })
    assert response.status_code == 201
    assert "id" in response.json()

async def test_create_agent_duplicate_role():
    """重复角色标识返回 409"""
    # 先创建一个
    await client.post("/api/agents", json={...})
    # 再创建相同角色
    response = await client.post("/api/agents", json={...})
    assert response.status_code == 409
```

### Step 2: 运行测试 → 失败 (RED)

```bash
pytest tests/test_agent.py::test_create_agent_success -v
# 预期：FAIL (接口不存在)
```

### Step 3: 编写实现

**文件**: `virtual_team/repository/agents.py`

```python
async def create_agent(
    team_id: str,
    name: str,
    role_identifier: str,
    ...
) -> AgentDB:
    agent = AgentDB(
        id=str(uuid4()),
        team_id=team_id,
        name=name,
        role_identifier=role_identifier,
        ...
    )
    db.add(agent)
    await db.commit()
    return agent
```

**文件**: `virtual_team/routers/agents.py`

```python
@router.post("/api/agents", status_code=201)
async def create_agent(req: AgentCreateRequest):
    agent = await create_agent_service(...)
    return {"id": agent.id, "status": "created"}
```

### Step 4: 运行测试 → 通过 (GREEN)

```bash
pytest tests/test_agent.py::test_create_agent_success -v
# 预期：PASS
```

### Step 5: 重构优化 (REFACTOR)

- 提取公共参数校验
- 优化错误处理
- 保持测试通过

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_agent.py` |
| 数据库 | `virtual_team/database.py` (AgentDB) |
| Repository | `virtual_team/repository/agents.py` |
| API | `virtual_team/routers/agents.py` |
| Schema | `virtual_team/schemas/agent.py` |

---

## 测试覆盖率

**目标**：该功能相关代码测试覆盖率 ≥ 80%

**测试命令**：
```bash
# 后端
pytest tests/test_agent.py -v --cov=virtual_team/routers/agents --cov=virtual_team/repository/agents

# 前端（如有）
npm run test:coverage
```

**覆盖率报告**：
- 终端输出：显示行覆盖率百分比
- HTML 报告：`frontend/coverage/`（前端）或 `htmlcov/`（后端）

**验收标准**：
- [ ] 所有测试用例通过
- [ ] 覆盖率 ≥ 80%
- [ ] 关键路径（创建、重复检查）100% 覆盖

---

## 进度

| 步骤 | 状态 |
|---|---|
| 编写测试 | ✅ |
| 测试失败 (RED) | ✅ |
| 编写实现 | ✅ |
| 测试通过 (GREEN) | ✅ |
| 重构 (REFACTOR) | ✅ |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本，完成创建 Agent 功能 |
| v1.1.0 | 2026-06-06 | Sisyphus | 添加测试覆盖率要求 |
