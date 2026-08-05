# Add 02: 行业竞品主流对标与路线图 Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-n2 main -b docs/n2-benchmark`）。只创建文档，不改代码。**与 P9（docs 入库）协作：本方案先 merge，P9 的 `git add docs/` 会一并入库。**

**Goal:** 沉淀 2026-08-05 多 Agent 行业对标结论，给出「现状定位 + 差距 + 阶段路线图」，作为后续开发依据。
**Architecture:** 纯文档方案，写入 `docs/benchmark/`，内容基于 4 个官方源实证（LangGraph/CrewAI/AutoGen/OpenAI Agents SDK README）+ 本项目代码核验。
**Tech Stack:** markdown

## 并行协调

- 独占文件：`docs/benchmark/2026-08-05-competitor-benchmark.md`（新）
- 依赖关系：**先于 P9 merge**（P9 会把 docs/ 全部入库）
- 零代码文件冲突

## Global Constraints

- 只写文档，不改代码
- 对标结论必须标注证据等级（✅ 官方/实证 / ⚠️ 推断 / ❌ 证伪）
- 遵循 AGENTS.md 多源核验铁律（≥3 权威源）

---

## 目标产出

一份文档，含四节：现状定位 / 五维对标表 / 差距清单 / 三阶段路线图。

- [ ] **Step 1: 创建 `docs/benchmark/2026-08-05-competitor-benchmark.md`**

内容骨架（直接写入，数据来自本会话已核验结论）：

```markdown
# 多 Agent 协作 · 行业竞品主流对标（2026-08-05）

> 结论基于官方 README 实证 + 本项目代码核验。证据等级：✅官方/实证 ⚠️推断 ❌证伪

## 一、本项目现状定位（核验版）
- 已实现：DAG 编排（fan-out/fan-in）、每节点**实时流式**（node_factory 直发 Redis，
  前端按 agent_name 分气泡）✅、固定 3 策略、关键词路由
- 未实现：审批门禁（approved 无读取点）❌、迭代回环（max_rounds 未用）❌、
  结构化输出、LLM 路由、HITL

## 二、五维对标表（源：LangGraph / CrewAI / AutoGen / OpenAI Agents SDK 官方 README）
| 维度 | 本项目 | 行业主流 | 差距 |
|---|---|---|---|
| 编排模式 | DAG + 固定策略 | DAG/supervisor/swarm/handoff | 待加 |
| 角色模型 | 3 硬编码 | CrewAI role/goal/backstory 声明式 | 待加 |
| 动态路由 | 关键词子串 | OpenAI handoffs / 层级委派 | 待加 |
| 流式 | 已实现（每节点）✅ | run_stream/astream_events 一等公民 | 达标 |
| HITL | 无 | interrupts / human-in-the-loop | 待加 |
| 记忆 | checkpointer | 短/长期 memory + sessions | 达标 |
| 质量门 | 无强制执行 | 结构化输出/guardrails/人工 review | 待加 |
| 可观测 | 自建 EventStore | LangSmith / tracing | 达标 |

## 二·五、同层对标（LangGraph 官方多 Agent 模式——本项目架构首选参照）

> 事实：本项目基于 LangGraph 原语自建编排；CrewAI 依赖 langchain-core 而非 langgraph（官方 pyproject 实证），故 CrewAI 是「产品能力参照」，LangGraph 官方 supervisor/swarm 才是「同层架构参照」。

| LangGraph 官方模式 | 说明 | 本项目现状 | 差距 |
|---|---|---|---|
| **supervisor**（`/reference/supervisor/`） | 中央协调者 LLM 分派子 Agent | 无 supervisor 节点类型 | 待加（可作 add-01 后续） |
| **swarm**（`/reference/swarm/`） | 轻量 handoff 交接 | 无 handoff 机制 | 待加 |
| **agents 原语** | 高层 agent 封装 | 使用低层 StateGraph 自建 | 可用但未封装 |
| **subgraph** | 子图嵌套组合 | 未使用 | 可选 |
| **MCP**（`/reference/mcp/`） | 一等公民 | 已实现 MCP 绑定 ✅ | 达标 |

## 三、差距清单（可执行化）
1. 审批不执行（已确认）→ 对应 add-01
2. 无迭代回环 → add-01
3. 无结构化输出 → add-01
4. 无 LLM 路由 → add-01
5. 无 HITL → add-01(后端) + add-03(前端)
6. 前端策略选择/状态展示缺失 → add-03
7. 引擎单趟直通 → 已被 add-01 覆盖

## 四、三阶段路线图
- Phase 1 地基修复（14 项 fix-01..14）：门禁可信、安全、工程化 → 评分 6.2→7.3
- Phase 2 协作闭环（add-01 + add-03）：审批/迭代/结构化/路由/UI → 对齐 CrewAI Flows 水平
- Phase 3 动态智能（follow-up）：handoff/层级委派、HITL 弹窗、A2A 互操作 → 对齐 OpenAI SDK 水平
```

- [ ] **Step 2: 校验文档无虚假断言**

对照本会话核验证据逐条复核（尤其 ✅/❌ 标记必须对应代码事实）。

- [ ] **Step 3: Commit**

```bash
git add docs/benchmark/
git commit -m "docs: multi-agent competitor benchmark & roadmap"
```

## Self-Review

- 与 add-01 的差距清单一一对应，路线图映射到具体 md
- 证据等级标注完整，无模型记忆型断言（除标注 ⚠️）
- 纯文档，零代码冲突
