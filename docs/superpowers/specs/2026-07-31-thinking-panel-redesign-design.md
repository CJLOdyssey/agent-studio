# 思考面板重构设计

> 将 Agent 思考面板从「纯文本 + 裸 Markdown 标记」重写为「结构化节点卡片 + 卡片内渲染 Markdown」。用户已通过视觉对比选定方案 A。

## 背景

当前 `TeamMessage.tsx` 的思考面板把后端 `Message.thinking` 纯文本按段切分后，以点号时间线的形式平铺渲染。问题：

- 推理文本里的 `**加粗**`、`### 标题`、`` `code` ``、代码围栏全部裸露显示
- `[skill] skill_code_review({})[result] 输出约束：...` 工具调用与结果挤在一起，难以辨认 Agent 的动作
- 长工具结果直接铺开，占用大量高度

后端逻辑正确（`parseNode` 已能识别 `[tools|mcp|skill|result|info]` 前缀，`groupThinkingNodes` 已能配对 call+result），**问题只出在渲染层**。

## 设计思路

**前端单文件重写渲染层，后端零改动。** 数据流、切分逻辑、前后缀规则全部保持现状，只替换 `TeamMessage.tsx` 中的卡片渲染。

三类卡片，同一套视觉语言：

```
推理卡         ● 推理文本（渲染 Markdown）
工具调用卡     [skill] skill_code_review({})
                   ⟶ 结果（默认折叠，点击展开）      ← 带类型色徽章
info 卡        [info] 提示信息（弱化样式）
```

## 组件架构

```
TeamMessage (容器, 保持不变)
 └─ ThinkingBody (现有 max-h/滚动/时间线容器, 保持不变)
     └─ ThinkingCard (替换现有 ThinkingNodeItem)
         ├─ ReasoningCard      ← 推理 / info / 未识别节点
         └─ ToolCallCard       ← tools / mcp / skill 调用 (+ 可折叠 result)
             └─ ResultBody     ← 默认折叠，展开渲染 Markdown
```

### 解析层（保持原样）

- `parseNode`：前后缀识别，不动
- `groupThinkingNodes`：切分 + call/result 配对，不动
- 无法解析的裸段落 → 走 `ReasoningCard`（与现状一致，作为兜底）

### 渲染层（本次唯一改动）

**ReasoningCard**
- 保留左侧时间线圆点，行内渲染 `parsed.rest`
- 文本用 `ReactMarkdown` 渲染（加粗/斜体/行内代码/列表/标题）
- 裸 URL：通过 ReactMarkdown 的自定义 `text` 组件复用现有 `linkify()`，保证超链接可点击（ReactMarkdown 默认不自动识别裸 URL）
- `info` 前缀维持弱化样式（tertiary 色）

**ToolCallCard**
- 第一行：类型徽章（`[skill]` 紫 / `[mcp]` 青 / `[tools]` 琥珀）+ 等宽字体调用文本 `skill_code_review({})`
- 第二行：`⟶` 结果，**默认折叠**，整卡可点击展开/收起
- 结果体用 `ReactMarkdown` 渲染（工具返回的指令/输出约束常含列表与代码块）
- 无配对 result 时：调用卡单独显示，结果区显示「无返回」弱提示（沿用现有 `[tools]`→`[result]` 兜底逻辑，仅改文案）

### Markdown 渲染复用

思考卡与正文复用同一套 `ReactMarkdown components`（`ul/ol/li/p/code` + `CodeBlock`），保证视觉一致，不新增依赖（`react-markdown ^9.1.0` 已在项目中使用）。

## 状态与交互

| 状态 | 表现 |
|---|---|
| 思考进行中（isTyping 前） | 现状不变：spinner + 可折叠 |
| 思考完成 | 现状不变：header 折叠 + 卡片区 |
| 工具结果 | 默认折叠，点击卡片展开（`useState` per card） |
| 未识别裸段落 | 走 ReasoningCard 兜底渲染 |

## 数据流（不变）

```
后端 Message.thinking (字符串)
  → groupThinkingNodes 切分
  → ThinkingCard 分发 (reasoning / tool)
  → ReactMarkdown 渲染
```

## 错误处理

- 空 thinking / 空节点 → 现有空态逻辑不变
- 未知前缀 / 无前缀裸文本 → ReasoningCard 兜底
- markdown 中的非法 HTML → 沿用现有 `ReactMarkdown` 默认过滤 + `sanitizeHtml` 约定

## 测试

- 更新 `TeamMessage.render.test.tsx` 的 thinking 相关用例：
  - 推理节点渲染 Markdown（`**bold**` → 加粗，不出现裸 `**`）
  - `[skill]` / `[mcp]` / `[tools]` 调用卡显示徽章与调用文本
  - 工具结果默认折叠，点击后展开
  - 裸段落兜底仍渲染
- 现有测试断言（thinkingComplete / thinkingStopped / thinkingPending / 展开收起）不破坏

## 范围

**在范围内：** 思考面板卡片化渲染、工具结果折叠、Markdown 渲染。

**不在范围内（YAGNI）：** 后端 thinking 结构化改造、摘要自动生成（方案 C）、紧凑时间线（方案 B）、思考持久化、跨端复用的独立组件库抽取。

## 参考

- 前端实现：`frontend/src/components/AgentStudio/TeamMessage.tsx`（parseNode:35、groupThinkingNodes:53、ToolCallBranch:89、ThinkingNodeItem:124）
- 后端数据源：`backend/src/streaming/emitter.py`（emit_thinking_nodes、emit_tool_results）
- 依赖：`react-markdown ^9.1.0`（已在 package.json）
