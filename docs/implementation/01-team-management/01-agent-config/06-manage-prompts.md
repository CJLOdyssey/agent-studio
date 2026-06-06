---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：管理提示词版本

> 子域：Agent 配置管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为团队管理员，我希望管理 Agent 的提示词版本，支持多版本创建和切换。

---

## 验收标准

- [ ] 创建新版本自动递增 version
- [ ] 切换生效版本 (is_active)
- [ ] 查询版本历史
- [ ] 同一 Agent 只有一个生效版本

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_prompt.py`

```python
async def test_create_prompt_version():
    """创建提示词版本"""
    agent_id = await create_test_agent()
    
    response = await client.post(f"/api/agents/{agent_id}/prompts", json={
        "content": "你是一个产品经理...",
        "change_reason": "初始版本"
    })
    assert response.status_code == 201
    assert response.json()["version"] == 1

async def test_create_multiple_versions():
    """多版本自动递增"""
    agent_id = await create_test_agent()
    
    await client.post(f"/api/agents/{agent_id}/prompts", json={"content": "v1"})
    resp2 = await client.post(f"/api/agents/{agent_id}/prompts", json={"content": "v2"})
    
    assert resp2.json()["version"] == 2

async def test_activate_prompt_version():
    """切换生效版本"""
    agent_id = await create_test_agent()
    
    # 创建 2 个版本
    resp1 = await client.post(f"/api/agents/{agent_id}/prompts", json={"content": "v1"})
    resp2 = await client.post(f"/api/agents/{agent_id}/prompts", json={"content": "v2"})
    
    # 激活 v1
    await client.post(f"/api/agents/{agent_id}/prompts/activate", json={
        "prompt_id": resp1.json()["id"]
    })
    
    # 验证 v1 生效，v2 不生效
    prompts = await client.get(f"/api/agents/{agent_id}/prompts")
    for p in prompts.json():
        if p["version"] == 1:
            assert p["is_active"] == True
        else:
            assert p["is_active"] == False
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/prompts.py`

```python
async def create_prompt(agent_id: str, content: str, ...) -> AgentPromptDB:
    # 获取当前最大版本号
    max_version = await get_max_version(agent_id)
    
    prompt = AgentPromptDB(
        id=str(uuid4()),
        agent_id=agent_id,
        version=max_version + 1,
        content=content,
        is_active=max_version == 0,  # 第一个版本自动激活
        ...
    )
    db.add(prompt)
    await db.commit()
    return prompt

async def activate_prompt(agent_id: str, prompt_id: str):
    # 取消其他版本的激活状态
    await db.execute(
        update(AgentPromptDB)
        .where(AgentPromptDB.agent_id == agent_id)
        .values(is_active=False)
    )
    # 激活指定版本
    await db.execute(
        update(AgentPromptDB)
        .where(AgentPromptDB.id == prompt_id)
        .values(is_active=True)
    )
    await db.commit()
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_prompt.py` |
| 数据库 | `virtual_team/database.py` (AgentPromptDB) |
| Repository | `virtual_team/repository/prompts.py` |
| API | `virtual_team/routers/prompts.py` |

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
