---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：设置审批者

> 子域：权限与审批
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望指定某个 Agent 为审批者，负责批准或拒绝代码。

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

- [ ] 设置 Agent 为审批者
- [ ] 取消审批者身份
- [ ] 至少保留一个审批者

---


---

## 风险点

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 待识别 | 中 | 待定 |

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_permission.py`

```python
async def test_set_approver():
    agent_id = await create_test_agent()
    response = await client.put(f"/api/agents/{agent_id}", json={
        "is_approver": True
    })
    assert response.status_code == 200

async def test_cannot_remove_last_approver():
    agent_id = await create_test_agent(is_approver=True)
    response = await client.put(f"/api/agents/{agent_id}", json={
        "is_approver": False
    })
    assert response.status_code == 400
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/agents.py`

```python
async def set_approver(agent_id: str, is_approver: bool) -> bool:
    if not is_approver:
        approvers = await get_approvers()
        if len(approvers) <= 1:
            return False
    
    agent = await get_agent_by_id(agent_id)
    agent.is_approver = is_approver
    await db.commit()
    return True
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_permission.py` |
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
| 重构 (REFACTOR) | ⬜ | - |
| Code Review | ⬜ | - |
| 部署验证 | ⬜ | - |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
