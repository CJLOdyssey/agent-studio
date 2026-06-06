---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：绑定工具

> 子域：Agent 配置管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为团队管理员，我希望为 Agent 绑定可用工具，以便 Agent 执行特定任务。

---


---

## 接口定义

**[METHOD] /api/[endpoint]**

请求：
```json
{
  "field": "value"
}
```

响应 200/201：
```json
{
  "id": "uuid"
}
```

## 验收标准

- [ ] 绑定已有工具
- [ ] 解绑工具
- [ ] 查询 Agent 工具列表
- [ ] 支持 config_override 覆盖默认配置

---


---

## 风险点

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 待识别 | 中 | 待定 |

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_binding.py`

```python
async def test_bind_tool():
    """绑定工具"""
    agent_id = await create_test_agent()
    tool_id = await create_test_tool()
    
    response = await client.post(f"/api/agents/{agent_id}/tools", json={
        "tool_id": tool_id
    })
    assert response.status_code == 201

async def test_unbind_tool():
    """解绑工具"""
    agent_id = await create_test_agent()
    tool_id = await create_test_tool()
    
    # 先绑定
    await client.post(f"/api/agents/{agent_id}/tools", json={"tool_id": tool_id})
    
    # 解绑
    response = await client.delete(f"/api/agents/{agent_id}/tools/{tool_id}")
    assert response.status_code == 200

async def test_list_agent_tools():
    """查询 Agent 工具列表"""
    agent_id = await create_test_agent()
    tool_id = await create_test_tool()
    
    await client.post(f"/api/agents/{agent_id}/tools", json={"tool_id": tool_id})
    
    response = await client.get(f"/api/agents/{agent_id}/tools")
    assert response.status_code == 200
    assert len(response.json()) == 1
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/bindings.py`

```python
async def bind_tool(agent_id: str, tool_id: str, ...) -> AgentToolBindingDB:
    binding = AgentToolBindingDB(
        id=str(uuid4()),
        agent_id=agent_id,
        tool_id=tool_id,
        ...
    )
    db.add(binding)
    await db.commit()
    return binding

async def unbind_tool(agent_id: str, tool_id: str) -> bool:
    result = await db.execute(
        delete(AgentToolBindingDB)
        .where(
            AgentToolBindingDB.agent_id == agent_id,
            AgentToolBindingDB.tool_id == tool_id
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
| 测试 | `tests/test_binding.py` |
| 数据库 | `virtual_team/database.py` (AgentToolBindingDB) |
| Repository | `virtual_team/repository/bindings.py` |
| API | `virtual_team/routers/bindings.py` |

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
| 重构 (REFACTOR) | ⬜ | - |
| Code Review | ⬜ | - |
| 部署验证 | ⬜ | - |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
