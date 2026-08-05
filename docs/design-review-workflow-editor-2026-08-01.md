# 工作流创建 · 编排器分析（2026-08-01）

> 按既定流程分析「工作流创建/编排」。**工作流是本项目最重要、最新、最核心的功能**，且不是传统表单，而是 **ReactFlow 图编排器**（`WorkflowEditor.tsx`，365 行）——选团队 → 拖 agent 节点 → 连线 → 设 strategy/maxRounds/condition → 保存。
>
> 支撑文件：`WorkflowEditor.tsx`、`WorkflowManagement.tsx`、`types/AgentStudio.ts`（WorkflowConfig/Node/Edge）、`backend/src/workflow/models.py`、`backend/src/orm/workflow.py`、`backend/src/routers/workflows.py`、`backend/src/repository/workflows.py`、`backend/src/workflow/node_factory.py`、`backend/src/tasks/team_pipeline.py`。
>
> **多元竞品参照**（本功能最重要的分析）：**LangGraph**（官方编排框架）+ **Dify Workflow**（可视化编排）+ **n8n**（最成熟图编排工具）+ Anthropic multi-agent。

---

## 第 1 步 — 要不要做

判断三问：
1. 不做它用户损失什么？—— **有且巨大**。工作流是 multi-agent 协作的编排核心（`team_pipeline.py` 运行时驱动），无工作流则团队无法执行。
2. 验收标准可测吗？—— 可测。`team_pipeline.py` 按 WorkflowConfig 的 nodes/edges 执行。
3. 拆掉一半核心价值还在吗？—— **在但需审慎**。节点+连线即最小可运行集，但缺少入口/输出/分支/测试则是不完整编排器。

**结论：合理功能，系统最重要的功能，值得对标行业最优。**

## 第 2 步 — 5 要素描述

**用户**：开发者/运维。**场景**：需编排多个 Agent 按 DAG 协作完成复杂任务。**目标**：定义节点（agent+strategy）、连线（依赖+条件）、执行参数（maxRounds）。**行为**：选团队 → 添加 agent 节点 → 连线 → 设策略 → 保存到 workflow_configs 表。**验收**：运行时可被 `team_pipeline.py` 按 nodes/edges 驱动执行。

## 第 3 步 — 多元竞品分析（核心）

工作流编排器的行业最优实践来自 4 个权威参照，逐项对照：

### 参照 1：LangGraph（官方编排框架，本项目后端实际依赖它）

```python
graph = StateGraph(MessagesState)
graph.add_node(mock_llm)                      # 节点
graph.add_edge(START, "mock_llm")             # 显式 START/END 节点
graph.add_edge("mock_llm", END)
```

**LangGraph 核心：显式 START / END 节点 + 条件边 + 持久化 + 人工介入。** 项目后端 `dynamic_team_graph.py` 用 LangGraph，但前端编辑器不暴露 START/END。

### 参照 2：Dify Workflow（可视化编排平台）

| Dify 要素 | 说明 |
|-----------|------|
| **开始节点** | Workflow 以 User Input / Trigger 开始（强制） |
| **结束节点** | Workflow 以 Output 节点结束（Workflow）/ Answer（Chatflow，强制） |
| **分支节点** | IF/ELSE 条件分支、问题分类器 |
| **节点面板** | 点节点即开参数配置面板 |
| **测试** | 可运行/测试工作流 |

### 参照 3：n8n（最成熟图编排工具）

| n8n 要素 | 说明 |
|----------|------|
| **Trigger 节点** | 第一个节点必须是 trigger（手动/定时/事件） |
| **分支** | If node → true/false 两条输出 |
| **节点参数面板** | 点节点即配置（credentials、表达式 `{{ }}`） |
| **逐节点测试** | Execute step 单步执行看输出 |
| **表达式** | `{{ $json["classType"] }}` 节点间传值 |

### 参照 4：Anthropic multi-agent

「每个子 agent 需要 objective、输出格式、工具、任务边界」——节点应有**独立指令/输入/输出契约**。

### 四源共性 → 行业最优特征

| 特征 | LangGraph | Dify | n8n | Anthropic | **本项目** |
|------|-----------|------|-----|-----------|-----------|
| 显式入口节点 | ✅ START | ✅ Trigger | ✅ Trigger | — | ❌ 隐式（order 最小） |
| 显式结束节点 | ✅ END | ✅ Output | ✅ 末节点 | — | ❌ 无 |
| 条件/分支 | ✅ 条件边 | ✅ IF/ELSE | ✅ If | ✅ 分工 | ⚠️ 仅 condition_key 无 UI |
| 节点配置面板 | — | ✅ | ✅ | — | ⚠️ 仅 strategy 下拉 |
| 逐节点/整体测试 | ⚠️ | ✅ | ✅ | ✅ evals | ❌ 无 |
| 节点输入/输出契约 | ✅ | ✅ | ✅ 表达式 | ✅ | ❌ 无 |

## 第 4 步 — 工作流编辑器的设计合理性深度分析

### W1. 入口：选团队（合理但耦合）

- **设计**：`WorkflowManagement.tsx:47-52` 先选团队，`WorkflowConfigDB.team_id` 唯一（`orm/workflow.py:21-23`）——**每个团队一个工作流**。
- **判定**：✅ 合理（一团队一工作流是清晰模型）。但**入口是下拉选择团队**，无「新建工作流」概念——工作流生命周期绑定团队，创建即选团队。对照 n8n/Dify 有独立工作流列表+创建按钮，本项目是「团队驱动」。
- **问题**：团队为空时下拉空，无引导创建团队的提示（`WorkflowManagement.tsx:64-66` 只显示「选择一个团队开始编排」）。

### W2. 名称 name（合理但非必填）

- **设计**：`WorkflowEditor.tsx:314` input；保存时 `name || '未命名工作流'`（`:284`）。
- **判定**：✅ 合理。默认「未命名工作流」可接受。但**无 name 校验**（可空、无长度限制），后端 `WorkflowConfigDB.name nullable=False`（`orm/workflow.py:24`）——空字符串也存，无冲突。

### W3. 最大轮次 maxRounds（合理）

- **设计**：`:316` number input min=1 max=10；后端 `max_rounds default=5`（`models.py:56`）。
- **判定**：✅ 合理。Anthropic multi-agent 明确「scale effort to query complexity」——maxRounds 是执行轮次上限，合理。但**无字段说明**（用户不知道 maxRounds 是干嘛的，无 tooltip）。

### W4. 节点：agent 添加（合理但无入口校验）

- **设计**：`:327-331` 从团队 agents 点「+ name」添加；`:245-256` `addAgentNode` 用 `agent.name` 作节点 id，`agentConfigId` 从 agents 匹配。
- **判定**：✅ 合理（从团队成员拖节点）。**问题**：
  1. **节点 id 用 name**（`:250`）——agent 改名即断（同 MCP 的 id 用 name 顶替问题）。节点 `id: agent.name`，但保存时 `roleIdentifier: n.id`（`:270`），后端 `role_identifier` 关联 agent——改名后节点匹配不到 agent
  2. **随机位置**（`:246` `Math.random()`）——节点散落，无自动布局，多节点时混乱
  3. **无入口节点概念**——第一个节点自动成为入口（`models.py:73 get_entry_node` order 最小），用户无法明确指定谁先执行

### W5. 节点策略 strategy（合理但表达受限）

- **设计**：`:30-34` STRATEGIES 三值（generator/reviewer/reporter）；`:133-169` 点策略徽章下拉切换。
- **判定**：✅ 合理。三种策略对应编排语义（生成/审查/报告），对齐 multi-agent 的分工。**但**：
  - 策略是**节点级唯一配置**，无节点输入/输出契约（Anthropic 要求「objective + output format + tools + 边界」）
  - reviewer 的「审查谁」无配置——`models.py` 只有 strategy 枚举，审查逻辑硬编码在 `strategies.py`，用户无法配置审查标准

### W6. 连线 edges（合理但分支表达不足）

- **设计**：`:220-222` onConnect 用 ReactFlow 加边；`:277` condition_key 从 edge label；`:278` is_default = !label。
- **判定**：⚠️ **核心能力不足**：
  1. **无分支配置 UI**——n8n If node 有 true/false 两条输出，本项目边只能拖一条线，condition_key 靠手动改 edge label（用户几乎无法发现）
  2. **无 is_default 语义 UI**——后端有 `is_default/priority`（`orm/workflow.py:90-91`，`models.py:45-46`），前端保存 `isDefault: !e.label, priority: 0`（`:278-279`）——**priority 永远 0，default 由是否有 label 推断**，分支路由能力形同虚设
  3. **无环路校验**——可连接成环（A→B→A），`team_pipeline` 执行会死循环（有 maxRounds 兜底但无显式警告）
  4. **condition 无表达式**——n8n 用 `{{ $json.classType }}` 表达式，本项目 condition_key 是纯文本，无上下文引用能力

### W7. 执行/测试：缺失（P0，四源反衬）

- **设计**：无执行/测试按钮。
- **判定**：❌ **核心缺失**。n8n 有 Execute step、Dify 有测试运行、LangGraph 有 invoke、Anthropic 强调「evals」——**本项目工作流编辑器无法预览/测试执行**。用户编排完只能「保存」，不知道能不能跑、跑到哪一步。**这是四源全部具备而本项目缺失的唯一核心能力**。

### W8. 保存（有严重数据一致性隐患）

- **设计**：`:264-291` handleSave 组装 nodes/edges 调 `saveWorkflow`。
- **问题**：
  1. **node.id 为空字符串**（`:267` `find(...)?.id || ''`）——新建节点无 id，后端 `orm/workflow.py:49` 有默认 uuid 但保存映射需确认
  2. **删除节点不留痕**——删除节点后 `agentConfigId` 关联的 edge 一并删（`:208-209`），但已保存的 node 在 DB 里靠 cascade 清理（`orm/workflow.py:36-40`）——需确认 `save_workflow_config` 是否正确 diff 增删
  3. **无 dirty 检测**——无「未保存更改」提示，直接切团队会丢未保存改动

### W9. 删除（confirm 原生对话框）

- **设计**：`:293-298` 用 `confirm()` 原生对话框——**违背项目其他表单的确认弹窗模式**（DeleteConfirmModal）。
- **判定**：⚠️ UI 不一致。

### W10. 加分项

- **ReactFlow 能力**（`:339-361`）：拖拽、MiniMap、Controls、fitView——画布基础完备
- **Delete 键删除**（`:203-218`）：选中节点按 Delete 删除，符合画布交互
- **条件边视觉区分**（`:189`）：有 condition 的边用橙色虚线——加分
- **保存按钮 disabled**（`:317`）：nodes 为空禁存——加分
- **后端模型干净**（`models.py`）：WorkflowConfig/Node/Edge 分层清晰，`get_entry_node`/`get_outgoing_edges`/`get_previous_artifacts` 方法完备

## 第 5 步 — 消费链与字段去向（反向追踪）

```
WorkflowEditor 收集
  name/maxRounds → WorkflowConfigDB   → team_pipeline 读取       消费 ✅
  nodes(agent+strategy+order) → WorkflowNodeDB → node_factory.create → LLM 调用   消费 ✅
  edges(from/to/condition)   → WorkflowEdgeDB → graph_builder/dynamic_team_graph   消费 ✅
  condition_key              → edge label  → 路由（is_default/priority）          消费 ⚠️ 前端不暴露配置
  （无执行入口）              → —           → 无                                   缺失 ❌
```

**关键发现**：
1. **数据模型完整**（node/edge/config 三表 + strategy + condition + priority），**但前端编辑器只暴露了其中一半能力**——priority/is_default/condition 的完整配置 UI 缺失
2. **测试执行完全缺失**——n8n/Dify/LangGraph 的核心能力，本项目无

## 第 6 步 — 修复优先级

| 优先级 | 编号 | 问题 | 建议 |
|--------|------|------|------|
| P0 | W7 | 无执行/测试入口（四源反衬） | 加「运行」按钮调团队 pipeline 或节点单测 |
| P0 | W6 | 条件/分支无配置 UI（priority/is_default 形同虚设） | 加分支配置面板（对齐 n8n If node）或明确不支持分支 |
| P1 | W4 | 节点 id 用 name、随机位置 | 用 agentConfigId 作 id；自动布局 |
| P1 | W5 | 节点无输入/输出契约 | 节点面板加 objective/output format（对齐 Anthropic） |
| P1 | W1 | 无独立工作流列表/创建入口 | 对齐 Dify/n8n 工作流管理视图 |
| P2 | W6 | 无环路校验 | 保存时检测环，警告 |
| P2 | W8 | 无 dirty 检测 | 未保存更改提示 |
| P2 | W9 | confirm 原生对话框 | 改用项目 DeleteConfirmModal |
| P2 | W3 | maxRounds 无说明 | 加 tooltip |

## 健康形态建议

```
工作流编辑器（对齐 LangGraph/Dify/n8n 最优）：
  入口：独立工作流列表 + 新建（而非仅团队下拉）
  节点：显式 START 节点（明确谁先执行）+ 节点参数面板（objective/工具/输出格式）
  分支：条件边配置 UI（对齐 n8n If true/false）+ priority 可配
  输出：显式 END/Output 节点（对齐 Dify）
  测试：逐节点执行 + 整体运行（对齐 n8n Execute step）
  数据：节点用 agentConfigId 作 id；保存时环检测 + dirty 提示
```

## 结论

工作流是**本项目最重要的功能，数据模型是七表单中最好的**（node/edge/config 三表 + strategy + condition + priority + 方法完备），ReactFlow 画布基础能力也在线（拖拽/Delete 删除/条件边视觉/保存 disabled）。

但**前端编辑器只暴露了数据模型的一半能力**，对照 LangGraph/Dify/n8n 三个行业最优：
1. **P0 无测试执行**——四源全部具备，本项目无，用户无法验证编排是否正确
2. **P0 分支能力虚设**——后端有 condition_key/is_default/priority，前端只当 edge label 显示，无分支配置 UI
3. **P1 无显式入口/输出节点**——隐式 order 最小节点当入口，用户无法明确控制执行顺序
4. **P1 节点无输入/输出契约**——Anthropic 要求每个 agent 有 objective/output format/tools 边界

**最关键判断**：工作流编排器的价值 = **可视 + 可测 + 可控**。本项目「可视」做到了（ReactFlow），「可测」完全缺失，「可控」只有一半（strategy 可配，分支/顺序/契约不可配）。**数据模型完备但 UI 层是半成品——这是「后端能力 > 前端暴露」的典型，也是本项目投入产出比最高的优化点**。

---

## 附：八个表单/编辑器横向对照

| 维度 | Skill | MCP | 工具 | 提示词 | 输出约束 | Agent | 团队 | **工作流** |
|------|-------|-----|------|--------|---------|-------|------|-----------|
| 形态 | 表单 | 表单 | 表单 | 表单 | 表单 | 表单 | 表单 | **图编排器** |
| 核心字段 | instructions | command | parameters | content | content | systemPrompt | 成员+工作流 | **nodes+edges** |
| 多源对齐 | 3/9 | 5/9 | 4/8 | 4/7 | 2/5 | 5/10 | 4/4 | **后端模型完备 ✅** |
| 版本字段 | 必填 ❌ | 必填 ❌ | 必填 ❌ | 后端不收 ❌ | — | 选填 ⚠️ | 无 ✅ | **无 ✅** |
| 测试/预览 | 无 | 菜单内 | 表单内 ✅ | 无 | 无 | 菜单内 | 无 | **❌ 缺失（最重要）** |
| 分组 | 无 | 无 | 无 | 无 | 无 | 五 tab ✅ | 基本信息 ✅ | **画布自然分组** |
| 最严重问题 | 描述选填 | 状态形态错 | method/headers 缺 | 缺 description | 数据不消费 | output_constraints 塞元数据 | 核心内容不在表单 | **分支+测试缺失（半成品）** |

---

## 附 2：参照来源

| 来源 | 地址 | 作用 |
|------|------|------|
| LangGraph 文档 | https://docs.langchain.com/oss/python/langgraph/ | 显式 START/END、条件边、持久化 |
| Dify Workflow | https://docs.dify.ai/en/guides/workflow | 开始/结束节点、分支、节点面板 |
| n8n Workflow 教程 | https://docs.n8n.io/build-your-first-workflow.md | Trigger 节点、If 分支、表达式、逐节点测试 |
| Anthropic multi-agent | https://www.anthropic.com/engineering/multi-agent-research-system | 节点分工契约、evals |
