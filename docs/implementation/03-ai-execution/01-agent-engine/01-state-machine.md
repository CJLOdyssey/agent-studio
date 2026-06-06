---
version: v1.1.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：状态机定义

> 子域：Agent 引擎
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为系统，我需要定义 LangGraph 状态机的节点和边。

---

## 验收标准

- [ ] 定义 TeamState 状态
- [ ] 定义节点：PM、前端、后端、测试员
- [ ] 定义边：节点间的流转关系

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_team_graph.py`

```python
async def test_team_graph_structure():
    graph = TeamGraph()
    assert "pm" in graph.nodes
    assert "frontend" in graph.nodes
    assert "backend" in graph.nodes
    assert "tester" in graph.nodes
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/team_graph.py`

```python
class TeamState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    requirement: str
    pm_document: str
    code: str
    review: str
    approved: bool
    round_number: int

class TeamGraph:
    def __init__(self):
        self.graph = StateGraph(TeamState)
        self.graph.add_node("pm", self.pm_node)
        self.graph.add_node("frontend", self.frontend_node)
        self.graph.add_node("backend", self.backend_node)
        self.graph.add_node("tester", self.tester_node)
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_team_graph.py` |
| 核心 | `virtual_team/team_graph.py` |

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
