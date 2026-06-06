---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：更新 Agent

> 子域：Agent 配置管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为团队管理员，我希望修改 Agent 的配置信息，以便灵活调整团队成员。

---

## 验收标准

- [ ] 可以更新任意字段
- [ ] 只更新提供的字段，未提供的保持不变
- [ ] Agent 不存在返回 404
- [ ] 更新成功返回 updated 状态

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_agent.py`

```python
async def test_update_agent_success():
    """更新 Agent 成功"""
    create_resp = await client.post("/api/agents", json={...})
    agent_id = create_resp.json()["id"]
    
    response = await client.put(f"/api/agents/{agent_id}", json={
        "name": "新名称",
        "temperature": 0.5
    })
    assert response.status_code == 200
    
    # 验证更新
    get_resp = await client.get(f"/api/agents/{agent_id}")
    assert get_resp.json()["name"] == "新名称"
    assert get_resp.json()["temperature"] == 0.5

async def test_update_agent_partial():
    """部分更新不影响其他字段"""
    # 创建 → 更新只改 name → 验证其他字段不变
    ...

async def test_update_agent_not_found():
    """Agent 不存在返回 404"""
    response = await client.put("/api/agents/nonexistent", json={...})
    assert response.status_code == 404
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/agents.py`

```python
async def update_agent(agent_id: str, **kwargs) -> AgentDB | None:
    agent = await get_agent_by_id(agent_id)
    if not agent:
        return None
    for key, value in kwargs.items():
        if value is not None:
            setattr(agent, key, value)
    await db.commit()
    return agent
```

**文件**: `virtual_team/routers/agents.py`

```python
@router.put("/api/agents/{agent_id}")
async def update_agent(agent_id: str, req: AgentUpdateRequest):
    agent = await update_agent_service(agent_id, **req.model_dump(exclude_unset=True))
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    return {"id": agent.id, "status": "updated"}
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
