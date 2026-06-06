---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：删除 Agent

> 子域：Agent 配置管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为团队管理员，我希望删除不需要的 Agent，以便保持团队精简。

---

## 验收标准

- [ ] 删除成功返回 deleted 状态
- [ ] Agent 不存在返回 404
- [ ] 不能删除唯一的审批者
- [ ] 级联删除关联的绑定数据

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_agent.py`

```python
async def test_delete_agent_success():
    """删除 Agent 成功"""
    create_resp = await client.post("/api/agents", json={...})
    agent_id = create_resp.json()["id"]
    
    response = await client.delete(f"/api/agents/{agent_id}")
    assert response.status_code == 200
    
    # 验证已删除
    get_resp = await client.get(f"/api/agents/{agent_id}")
    assert get_resp.status_code == 404

async def test_delete_agent_not_found():
    """Agent 不存在返回 404"""
    response = await client.delete("/api/agents/nonexistent")
    assert response.status_code == 404

async def test_delete_last_approver():
    """不能删除唯一的审批者"""
    # 创建一个审批者
    create_resp = await client.post("/api/agents", json={..., "is_approver": True})
    agent_id = create_resp.json()["id"]
    
    response = await client.delete(f"/api/agents/{agent_id}")
    assert response.status_code == 400
    assert "审批者" in response.json()["detail"]
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/agents.py`

```python
async def delete_agent(agent_id: str) -> bool:
    agent = await get_agent_by_id(agent_id)
    if not agent:
        return False
    await db.delete(agent)
    await db.commit()
    return True
```

**文件**: `virtual_team/routers/agents.py`

```python
@router.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: str):
    # 检查是否是唯一的审批者
    agent = await get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    
    if agent.is_approver:
        approvers = await get_approvers()
        if len(approvers) <= 1:
            raise HTTPException(status_code=400, detail="不能删除唯一的审批者")
    
    await delete_agent_service(agent_id)
    return {"status": "deleted"}
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
