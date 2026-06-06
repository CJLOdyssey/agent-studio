---
version: v1.1.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：按轮次查询

> 子域：消息管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为用户，我希望按轮次查看消息。

---

## 验收标准

- [ ] 按 round_number 过滤
- [ ] 返回指定轮次的消息

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_message.py`

```python
async def test_list_messages_by_round():
    session_id = await create_test_session()
    run_id = await create_test_run(session_id)
    await save_test_message(run_id, "pm", "轮次1", round_number=1)
    await save_test_message(run_id, "tester", "轮次1审查", round_number=1)
    await save_test_message(run_id, "pm", "轮次2", round_number=2)
    
    response = await client.get(f"/api/sessions/{session_id}/messages?round=1")
    assert len(response.json()) == 2
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/messages.py`

```python
async def get_messages_by_round(session_id: str, round_number: int) -> list[MessageDB]:
    result = await db.execute(
        select(MessageDB)
        .join(ProjectRunDB, MessageDB.run_id == ProjectRunDB.id)
        .where(
            ProjectRunDB.session_id == session_id,
            MessageDB.round_number == round_number
        )
        .order_by(MessageDB.created_at)
    )
    return result.scalars().all()
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_message.py` |
| Repository | `virtual_team/repository/messages.py` |
| API | `virtual_team/routers/messages.py` |

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
