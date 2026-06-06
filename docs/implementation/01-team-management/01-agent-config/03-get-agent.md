---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：查询 Agent 详情

> 子域：Agent 配置管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为团队管理员，我希望查看某个 Agent 的完整配置详情，以便进行精细化管理。

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

- [ ] 返回 Agent 全部字段
- [ ] 包含绑定的工具、MCP、技能列表
- [ ] Agent 不存在返回 404

---


---

## 风险点

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 待识别 | 中 | 待定 |

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_agent.py`

```python
async def test_get_agent_success():
    """获取 Agent 详情"""
    create_resp = await client.post("/api/agents", json={...})
    agent_id = create_resp.json()["id"]
    
    response = await client.get(f"/api/agents/{agent_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "产品经理"

async def test_get_agent_not_found():
    """Agent 不存在返回 404"""
    response = await client.get("/api/agents/nonexistent")
    assert response.status_code == 404
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/agents.py`

```python
async def get_agent_by_id(agent_id: str) -> AgentDB | None:
    result = await db.execute(
        select(AgentDB).where(AgentDB.id == agent_id)
    )
    return result.scalar_one_or_none()
```

**文件**: `virtual_team/routers/agents.py`

```python
@router.get("/api/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = await get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    return {...}
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
