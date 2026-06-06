---
version: v1.0.0
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# 功能：[功能名称]

> 子域：[子域名称]
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成
> 优先级：P0 | P1 | P2
> 负责人：@[姓名]
> 预估：X 人天
> 截止：YYYY-MM-DD
> 依赖：[前置任务] | 无

---

## 用户故事

作为[角色]，我希望[功能]，以便[价值]。

---

## 验收标准

- [ ] 标准1
- [ ] 标准2
- [ ] 标准3

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
  "id": "uuid",
  "status": "success"
}
```

响应 4xx/5xx：
```json
{
  "detail": "错误信息"
}
```

---

## 数据库变更

```sql
-- 新增字段
ALTER TABLE table_name ADD COLUMN column_name TYPE;

-- 新增表
CREATE TABLE table_name (...);

-- 索引
CREATE INDEX idx_xxx ON table_name(column);
```

---

## 风险点

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 风险描述 | 高/中/低 | 解决方案 |

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_xxx.py`

```python
async def test_xxx():
    """测试描述"""
    response = await client.get("/api/xxx")
    assert response.status_code == 200
```

### Step 2: 运行测试 → 失败 (RED)

```bash
pytest tests/test_xxx.py -v
# 预期：FAIL
```

### Step 3: 编写实现

**文件**: `virtual_team/repository/xxx.py`

```python
async def xxx():
    pass
```

**文件**: `virtual_team/routers/xxx.py`

```python
@router.get("/api/xxx")
async def xxx():
    pass
```

### Step 4: 运行测试 → 通过 (GREEN)

```bash
pytest tests/test_xxx.py -v
# 预期：PASS
```

### Step 5: 重构优化 (REFACTOR)

- 优化点1
- 优化点2
- 保持测试通过

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_xxx.py` |
| 数据库 | `virtual_team/database.py` |
| Repository | `virtual_team/repository/xxx.py` |
| API | `virtual_team/routers/xxx.py` |
| Schema | `virtual_team/schemas/xxx.py` |
| 前端 | `frontend/src/xxx.tsx` |

---

## 测试覆盖率

**目标**：该功能相关代码测试覆盖率 ≥ 80%

**测试命令**：
```bash
# 后端
pytest tests/test_xxx.py -v --cov=virtual_team/routers/xxx --cov=virtual_team/repository/xxx

# 前端
npm run test:coverage
```

**验收标准**：
- [ ] 所有测试用例通过
- [ ] 覆盖率 ≥ 80%
- [ ] 关键路径 100% 覆盖

---

## 进度

| 步骤 | 状态 | 完成时间 |
|---|---|---|
| 编写测试 | ⬜ | - |
| 测试失败 (RED) | ⬜ | - |
| 编写实现 | ⬜ | - |
| 测试通过 (GREEN) | ⬜ | - |
| 重构 (REFACTOR) | ⬜ | - |
| Code Review | ⬜ | - |
| 部署验证 | ⬜ | - |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | YYYY-MM-DD | [姓名] | 初始版本 |
