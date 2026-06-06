---
version: v1.1.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：保存消息

> 子域：消息管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为系统，我希望保存 Agent 产生的消息。

---

## 验收标准

- [ ] 保存成功返回消息 ID
- [ ] 包含 role、content、round_number
- [ ] 关联 run_id

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_message.py`

```python
async def test_save_message_success():
    run_id = await create_test_run()
    response = await client.post("/api/messages", json={
        "run_id": run_id,
        "role": "pm",
        "content": "## PRD\n...",
        "round_number": 1
    })
    assert response.status_code == 201
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/messages.py`

```python
async def save_message(run_id: str, role: str, content: str, round_number: int) -> MessageDB:
    message = MessageDB(
        id=str(uuid4()),
        run_id=run_id,
        role=role,
        content=content,
        round_number=round_number
    )
    db.add(message)
    await db.commit()
    return message
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_message.py` |
| 数据库 | `virtual_team/database.py` (MessageDB) |
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
