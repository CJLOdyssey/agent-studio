---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：管理输出格式

> 子域：Agent 配置管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为团队管理员，我希望定义 Agent 的输出格式规范，确保输出结构化。

---

## 验收标准

- [ ] 创建输出格式 (JSON Schema)
- [ ] 查询格式列表
- [ ] 更新格式定义
- [ ] 删除格式

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_schema.py`

```python
async def test_create_output_schema():
    """创建输出格式"""
    agent_id = await create_test_agent()
    
    response = await client.post(f"/api/agents/{agent_id}/schemas", json={
        "name": "prd_template",
        "format_type": "markdown",
        "schema_def": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "requirements": {"type": "array"}
            }
        },
        "example": "# PRD\n\n## 需求\n..."
    })
    assert response.status_code == 201

async def test_list_output_schemas():
    """查询格式列表"""
    agent_id = await create_test_agent()
    await client.post(f"/api/agents/{agent_id}/schemas", json={...})
    
    response = await client.get(f"/api/agents/{agent_id}/schemas")
    assert response.status_code == 200
    assert len(response.json()) == 1
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/repository/schemas.py`

```python
async def create_output_schema(agent_id: str, ...) -> AgentOutputSchemaDB:
    schema = AgentOutputSchemaDB(
        id=str(uuid4()),
        agent_id=agent_id,
        ...
    )
    db.add(schema)
    await db.commit()
    return schema
```

**文件**: `virtual_team/routers/schemas.py`

```python
@router.post("/api/agents/{agent_id}/schemas", status_code=201)
async def create_schema(agent_id: str, req: SchemaCreateRequest):
    schema = await create_output_schema_service(agent_id, **req.model_dump())
    return {"id": schema.id, "status": "created"}
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_schema.py` |
| 数据库 | `virtual_team/database.py` (AgentOutputSchemaDB) |
| Repository | `virtual_team/repository/schemas.py` |
| API | `virtual_team/routers/schemas.py` |

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
