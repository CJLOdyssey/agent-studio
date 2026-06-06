# 03.1 LangGraph 多 Agent 编排

## 业务闭环

```
需求 → PM 分析 → 输出 PRD → 前端工程师实现 → 后端工程师实现 → 测试员审查 → 批准? → 是:结束 / 否:循环
```

## 状态机架构

```
START → pm → [direct_reply?] ──yes──→ END
              └── no ──→ frontend → backend → tester
                           └── [approved?] ──no──→ frontend (loop)
                                   └── yes ──→ END
```

## 核心文件

| 文件 | 说明 |
|---|---|
| `team_graph.py` | TeamGraph 类，定义状态机节点和边 |
| `agent_graph.py` | 单 Agent ReAct 引擎 |

## 状态定义

```python
class TeamState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    requirement: str
    pm_document: str
    code: str
    review: str
    approved: bool
    round_number: int
```

## 节点说明

| 节点 | 输入 | 输出 | 终止条件 |
|---|---|---|---|
| PM | 用户需求 | PRD 文档 | 输出包含 `【直接回复】` → END |
| 前端工程师 | PRD + 历史代码 | 前端代码 | — |
| 后端工程师 | PRD + 前端代码 | 后端代码 | — |
| 测试员 | PRD + 全部代码 | 审查意见 | 输出包含 `【批准】` → END |

## 循环控制

- 最大轮次：`MAX_ROUNDS`（可配置）
- 收敛检测：测试员输出包含 `APPROVAL_KEYWORD`（【批准】）
- 直接回复：PM 输出包含 `DIRECT_REPLY_KEYWORD`（【直接回复】）→ 跳过后续节点
