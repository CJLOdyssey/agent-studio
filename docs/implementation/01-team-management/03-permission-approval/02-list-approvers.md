---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：查询审批者列表

> 子域：权限与审批
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望查看当前的审批者列表。

---

## 验收标准

- [ ] 返回所有审批者
- [ ] 只返回 is_approver=True 的 Agent

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_permission.py`

```python
async def test_list_approvers():
    await create_test_agent(is_approver=True)
    await create_test_agent(is_approver=False)
    
    response = await client.get("/api/agents/approvers")
    assert response.status_code == 200
    assert len(response.json()) == 1
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/agents.py`

```python
async def get_approvers() -> list[AgentDB]:
    result = await db.execute(
        select(AgentDB).where(AgentDB.is_approver == True)
    )
    return result.scalars().all()
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
| 重构 (REFACTOR) | ⬜ |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
