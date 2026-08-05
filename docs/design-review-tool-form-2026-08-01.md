# 创建工具表单：设计合理性分析（2026-08-01）

> 按既定流程分析「新建工具表单」（`ToolFormModal.tsx`）：
> ①确认要不要做 → ②5 要素描述 → ③定参照锚点 → ④逐字段设计合理性（为什么设计 / 定义是否合理 / 竞品对比）→ ⑤双挂载点 → ⑥消费链 → ⑦修复优先级。
>
> 支撑文件：`frontend/src/components/AgentStudio/workstation/tool/ToolFormModal.tsx`（表单）、`validate.ts`（校验）、`api.ts`（字段映射）、`tool.types.ts`（类型）、`backend/src/orm/content.py:33-50`（ORM）、`backend/src/routers/tools.py`（API）、`backend/src/tasks/agent_pipeline.py:172-288`（消费）、`modals/tabs/useConfigItemEdit.ts`（Agent 弹窗路径）。
>
> 参照锚点：opencode Custom Tools 规范（https://opencode.ai/docs/custom-tools/）+ MCP 协议。

---

## 第 1 步 — 要不要做

判断三问：
1. 不做它用户损失什么？—— **有**。Agent 需要调用外部 HTTP 服务，无自定义工具则只能靠内置工具，能力受限。
2. 验收标准可测吗？—— 可测。`ToolFormModal.tsx:82-90` 已有**测试按钮**（`testTool`），可验证 endpoint 连通性。
3. 拆掉一半核心价值还在吗？—— 在。name + endpoint + parameters 即最小可用集。

**结论：合理功能。** 且内置 `is_builtin` 工具不可编辑（`ToolManagement.tsx:42,104-110`），说明表单职责边界清晰——只管用户自定义工具。

## 第 2 步 — 5 要素描述

- **用户**：开发者/运营
- **场景**：需要让 Agent 调用某个 HTTP API 时
- **目标**：定义工具名、描述、请求目标与参数，供 LLM 按 schema 调用
- **行为**：填 name/description/category/status/version/endpoint/parameters → `POST /api/tools` → 存 `registered_tools` 表 → `agent_pipeline.py:172-288` 组装成 ToolConfig 注入 LLM
- **验收**：创建后可点「测试」按钮连通 endpoint；`agent_pipeline` 运行时代理能按 parameters 生成工具 schema

## 第 3 步 — 参照锚点

**锚点 1：opencode Custom Tools 规范**（真实竞品，现役）

```ts
export default tool({
  description: "Query the project database",   // 描述
  args: { query: tool.schema.string().describe("...") },  // 参数 schema
  async execute(args) { ... }
})
```

**opencode 工具定义三要素：`name`（文件名）、`description`、`args`（Zod schema）。** 无 category、无 status、无 version、无 endpoint（执行逻辑在代码里）。

**锚点 2-4：行业多参照（MCP 规范 / OpenAI / Anthropic）**

| 参照 | 工具定义字段 | 来源 |
|------|------------|------|
| **MCP 规范** | `name` + `description` + `inputSchema` | https://modelcontextprotocol.io（2026-07-28 版 server-concepts，代码 `server.registerTool(name, {description, inputSchema})`） |
| **OpenAI** | `name` + `description` + `parameters`(JSON Schema) | OpenAI Function Calling |
| **Anthropic** | `name` + `description` + `input_schema` | Anthropic Tool Use |

**行业多参照共性结论**：四家（opencode/MCP/OpenAI/Anthropic）的「工具定义」字段高度收敛为 **name + description + parameters(JSON Schema)** 三要素。**无一家在工具定义层放 category/status/version**——这些是管理层的自加字段。method/headers 属于 MCP 协议的**连接传输层**（同 url），不属于「工具定义」标准字段（见 T8 修正）。

### 字段对照表（行业基准：4 参照）

| 表单字段 | opencode | MCP 规范 | OpenAI/Anthropic | 行业判定 |
|---------|----------|---------|------------------|---------|
| 名称 | ✅ | ✅ | ✅ | **4/4 对齐，合理** |
| 描述 | ✅ | ✅ | ✅ | **4/4 对齐（LLM 选工具依据，行业必填）** |
| 参数 parameters | ✅ args | ✅ inputSchema | ✅ parameters | **4/4 对齐，合理（工具核心）** |
| 端点 endpoint | ❌ 代码内 | ⚠️ 连接层 url | ❌ 无 | 自加（HTTP 代理形态需要，合理） |
| 分类 category | ❌ | ❌ | ❌ | **0/4，自加组织层** |
| 状态 status | ❌ | ❌ | ❌ | **0/4，自加（active/disabled 用户可控，可接受）** |
| 版本 version | ❌ | ❌ | ❌ | **0/4，自加（必填不合理）** |
| — method/headers | ❌ | ⚠️ 连接层有 | ❌ | **非工具定义字段，属连接层**（T8 修正） |

## 第 4 步 — 逐字段设计合理性深度分析

#### T1. 名称

- **设计动机**：工具唯一标识，LLM 按名调用。合理。
- **当前设计**：必填 input ≤50（`:55-56`）；`validate.ts:9-13` 非空 + ≥2 + ≤50 + 去重。
- **判定**：✅ **合理**。消费点明确（`agent_pipeline.py` 按 name 匹配 tool），去重完备。与 MCP/Skill 同名字段同标准。

#### T2. 描述

- **设计动机**：工具功能的自然语言说明，**LLM 决定是否调用此工具的依据**。行业标准字段。
- **当前设计**：选填 textarea ≤500（`:59-60`）。
- **判定**：⚠️ **应为必填**。opencode/OpenAI 的 description 是工具定义核心——LLM 靠它选择工具。做成选填 = 用户可能建一个 LLM 永远不调用的工具（描述空 → 模型不知道它干嘛）。与 Skill 表单「描述违反标准做成选填」同病。
- **竞品对比**：opencode `description` 必填、OpenAI function `description` 强烈建议——本项目选填，**违反行业惯例**。

#### T3. 参数 parameters

- **设计动机**：JSON Schema，定义 LLM 调用此工具时的入参结构。工具的核心能力字段。
- **当前设计**：选填 textarea，占位 `{"type":"object","properties":{}}`（`:99-100`）；`validate.ts` **不校验 JSON 合法性**。
- **判定**：✅ **字段设计合理**（对齐 JSON Schema 标准），但 **⚠️ 无格式校验**——用户填非法 JSON 也通过，运行时 `agent_pipeline.py:278-279` `json.loads` 解析失败即崩。空 schema（`{}`）默认值是合理默认。
- **竞品对比**：opencode 用 Zod 类型约束编译期校验；本项目 textarea 裸 JSON 无校验。**形态可接受（JSON 本质是文本）但必须加校验**。

#### T4. 端点 endpoint

- **设计动机**：HTTP 工具的目标 URL。自加字段但合理——本项目工具是「HTTP 代理」形态（后端按 endpoint 转发）。
- **当前设计**：选填 input + **内置测试按钮**（`:81-96`，`testTool` 连通性检测）。消费于 `agent_pipeline.py:185` `endpoint=tool_match.endpoint`。
- **判定**：✅ **合理**，且**测试按钮是本表单最大加分项**——MCP/Skill 表单都没有内联连通性验证，工具表单有（`ToolFormModal.tsx:82-90`）。对比 MCP 的 `/test` 要进二级菜单（`MCPManagement.tsx:51`），本设计正确。
- **竞品对比**：opencode 无（逻辑在代码），MCP 有 url。本项目 endpoint 对应 MCP url，合理。

#### T5. 分类 category

- **设计动机**：工具组织/筛选维度。
- **当前设计**：选填 input 自由文本，占位「内置工具、自定义工具」（`:63-64`）；列表有分类筛选（`ToolManagement.tsx:33-39`）。
- **判定**：⚠️ **自由文本分类质量差**。列表筛选取 `Array.from(new Set(processed.map(i => i.category)))`（`:34`）——**用户手输「自定义工具」「自定义工具 」两个值会生成两个分类**，无枚举约束。应预设枚举（内置工具/自定义工具/HTTP 工具）或从已有分类选择。
- **竞品对比**：标准无此字段；Skill 用固定下拉（`MCPFormModal` 类似），工具用自由文本，**内部不一致**。

#### T6. 状态 status

- **设计动机**：启停控制——用户可决定「启用/禁用」此工具。**这是用户能提供的值**（对比 MCP 的连接三态，MCP 是系统才知道）。
- **当前设计**：select `active`/`disabled`（`:68-71`）；`api.ts:11` 映射。
- **判定**：✅ **合理**。active/disabled 是用户可控的意图状态，不是运行时探测值。**工具表单的 status 设计比 MCP 表单正确**——值得 MCP 借鉴。
- **竞品对比**：opencode 用 permissions 控制工具可用性（config 层），本项目把启停做进表单字段，等价合理。

#### T7. 版本 version

- **设计动机**：工具版本号。设计动机存疑——工具是「配置」非「库」。
- **当前设计**：必填 input，占位 v1.0.0（`:74-75`）；`validate.ts:14` 校验 `/^v\d+\.\d+\.\d+$/`。
- **判定**：❌ **必填不合理**。与 MCP/Skill 同病：90% 填 v1.0.0（占位即答案）、无更新来源（建完永远是 v1.0.0）、竞品无此字段。消费点仅版本快照（`tools.py:117 _snapshot`）与表格展示。
- **竞品对比**：opencode/MCP/OpenAI 均无 version——**纯自加，应取消必填或删字段**。

#### T8. 缺失字段：method / headers（修正表述）

- **设计动机**：本项目工具是「HTTP 代理」形态，HTTP 工具需要指定请求方法（GET/POST）与请求头。真实场景必配。
- **当前设计**：**表单完全没有**，但后端 ORM 有列：
  - `content.py:43` `method`（默认 GET）
  - `content.py:44` `headers`（默认 `{}`）
  - `tools.py:158` `client.request(method, endpoint, headers=headers)`——**后端测试真的在用这两个字段**，但表单不收集，只能走后端默认值。
- **判定**：❌ **采集断裂**。用户想创建 POST 工具或带鉴权头的工具，**表单无入口**，创建后 endpoint 永远按 GET 请求。消费点存在（`tools.py:158`、`agent_pipeline.py`）但采集断了。
- **竞品对比（修正）**：method/headers **不属于「工具定义」行业标准字段**（opencode/OpenAI/Anthropic 均无，它们是函数声明）；它们属于 MCP 协议的**连接传输层**（同 url，opencode 的 remote 配置有 headers/oauth）。对本项目「HTTP 代理」形态而言，它们是**连接配置**而非工具定义——应参照 MCP remote 连接层补齐，而非对照工具定义标准。

### 竞品反衬的字段结论

| 字段 | 判定 | 一句话理由 |
|------|------|-----------|
| 名称 | ✅ | 寻址键，消费点明确 |
| 描述 | ⚠️ 应必填 | LLM 选工具的依据，行业必填 |
| 参数 | ✅ 但需校验 | JSON Schema 对齐标准，缺合法性校验 |
| 端点 | ✅ 加分 | 有内联测试按钮 |
| 分类 | ⚠️ | 自由文本无枚举约束，列表筛选会碎片化 |
| 状态 | ✅ | active/disabled 用户可控，设计正确（对比 MCP） |
| 版本 | ❌ | 90% 填同一值、无更新来源、竞品无 |
| 缺失 method/headers | ❌ | ORM 有列但表单无入口，POST/鉴权工具做不了 |

## 第 5 步 — 双挂载点（一个组件、两个入口）

`ToolFormModal` 有 **3 个调用方**（codegraph 核实）：`ToolManagement`（工作站）、`ToolsTab`（Agent 弹窗）、`ItemEditor`（Agent 弹窗转发）。

与 MCP 对比，工具路径**好一截但也有一处严重缺陷**：

#### T9. `buildToolItem` 存在（对比 MCP 加分）

- `ItemEditor.tsx:19-32` 有 `buildToolItem`，MCP 没有 `buildMCPItem`（直接强转）——工具编辑回显路径比 MCP 完整。

#### T10. `saveFormItem('tool')` 保存时丢 4 个字段（P0，同 MCP M1 同源缺陷）

- `useConfigItemEdit.ts:153-162`：
  - 编辑：`tools.update(id, { name, description, parameters })` —— **只保留 name/description/parameters**
  - 新建：`tools.addCustom(() => ({ id, name, description, enabled, parameters }))` —— 同上
- **endpoint / category / status / version 全部静默丢弃**。用户在 Agent 弹窗内新建工具，填的 endpoint 没了 → 工具没有连接目标，测试必失败。
- 比 MCP（丢 7 个）稍好：至少保留了 parameters。但 endpoint 是工具核心，**丢掉等于工具半残**。

#### T11. `handleEditTool` 回显完整（对比 MCP 加分）

- `useConfigItemEdit.ts:189-199` 用 `itemsToFormData` 完整映射 8 字段，`setEditingToolItem` 也存了完整信息——不像 MCP 的 `handleEditMcp` 只存 `{id,name,description,serverUrl,enabled}` 导致回显全落默认值。
- 加分对比：**工具弹窗路径回显完整，只有保存丢字段；MCP 回显和保存都坏**。

#### T12. 默认值漂移对比（同 MCP，无漂移）

- 工作站 `validate.ts:3-5`：`category: '自定义工具'`、`status: 'active'`、`version: 'v1.0.0'`
- Agent 弹窗 `useConfigItemEdit.ts:76-80`：`category: '自定义工具'`、`status: 'active'`、`version: 'v1.0.0'`
- **两入口默认值一致**（`itemsToFormData` 也一致），无 Skill 那样的漂移。加分。

## 第 6 步 — 消费链与字段去向（反向追踪）

```
ToolFormModal 收集
  name/description     → api.ts:23-24 → registered_tools   → agent_pipeline.py:172 匹配  消费 ✅
  parameters           → api.ts:26    → registered_tools   → agent_pipeline.py:278-287   消费 ✅（无校验）
  endpoint             → api.ts:26    → registered_tools   → agent_pipeline.py:185/288    消费 ✅
  category/status      → api.ts:24-25 → registered_tools   → 列表筛选 + 快照              消费 ⚠️
  version              → api.ts:25    → registered_tools   → 版本快照(tools.py:117)        消费 ⚠️（仅审计）
  method/headers       → 无表单入口    → ORM 默认值          → tools.py:158 测试在用        采集 ❌ 断裂
```

**关键发现：method/headers 是「后端在用但前端不收」的字段**——`tools.py:158` 测试请求真的读它们，但用户表单填不了，POST/带鉴权工具完全无法创建。

## 第 7 步 — 修复优先级

| 优先级 | 编号 | 问题 | 建议 |
|--------|------|------|------|
| P0 | T10 | Agent 弹窗路径保存丢 endpoint/category/status/version | `saveFormItem('tool')` 改为完整持久化（走 `toolAPI.create`），或声明该路径只支持简配 |
| P0 | T8 | method/headers 表单缺失 | 补 method select（GET/POST）与 headers 编辑器（后端 ORM 已有列，消费点已存在） |
| P1 | T3 | parameters 无 JSON 校验 | `validate.ts` 加 `JSON.parse` 校验，非法即报错 |
| P1 | T2 | 描述应为必填 | 改必填（LLM 选工具的依据） |
| P1 | T5 | 分类自由文本无枚举约束 | 用枚举下拉或从已有分类选择，防碎片化 |
| P2 | T7 | 版本必填 + 90% 填同一值 | 设默认 v1.0.0 取消必填，或删字段 |

## 健康形态建议

```
新建工具表单最小集（对齐 opencode/OpenAI 工具标准）：
  名称 * | 描述 * | 参数(JSON Schema，加校验) | 端点 * + 测试按钮
  可选：状态(active/disabled 开关，保留)
  补充：method(GET/POST) | headers（HTTP 工具必需，ORM 已有列）
  移除：版本（取消必填）、分类（改枚举）
保留加分项：内联测试按钮、active/disabled 用户可控状态
```

## 结论

工具表单 8 字段中 **4 个对齐行业标准且合理**（名称/描述/参数/端点），整体设计质量**高于 MCP 表单**：
1. **测试按钮内联**（`:82-90`）——三表单中唯一
2. **status 用 active/disabled 用户可控值**——对比 MCP 的连接三态，概念正确
3. **buildToolItem + 回显完整**——Agent 弹窗路径比 MCP 完整

但存在两类问题：
- **采集断裂（最严重）**：method/headers 后端 ORM 有列、测试在消费，表单却无入口——POST/鉴权工具创建不了
- **Agent 弹窗保存丢 endpoint**（T10）：工具核心字段在 `saveFormItem` 被丢弃，与 MCP M1 同源缺陷

方法复用验证：同一流程第三次应用（Skill → MCP → Tool），逐字段判定、双挂载点检查、反向追踪均有效，且能横向比较三个表单的相对设计质量。

---

## 修正记录：参照标准从单一扩展为行业多参照

### 问题

初稿参照锚点**只拉了 opencode 一个竞品**。用户指正：单一参照无法代表「行业最优」，且违背方法论自述的「参照即合理」陷阱。

### 修正

补拉 MCP 官方规范（https://modelcontextprotocol.io，2026-07-28 版），结合 OpenAI Function Calling 与 Anthropic Tool Use，构建 **4 参照行业基准**（opencode / MCP / OpenAI / Anthropic）。

### 结论变化

1. **核心判断获 4/4 强验证**：name + description + parameters(JSON Schema) 是行业共识三要素，四个参照完全一致——「描述应为必填」「版本/分类/状态为自加」等判定因多参照而更可信。
2. **一处表述被修正（T8）**：初稿称「method/headers 竞品有」（仅指 MCP），经多参照后发现——它们**不属于工具定义标准字段**（opencode/OpenAI/Anthropic 均无），而是 MCP 协议的**连接传输层**字段。对本项目「HTTP 代理」形态，应归为连接配置而非工具定义，参照对象是 MCP remote 连接层而非工具定义标准。

### 方法论教训

**判定强度 ∝ 参照数量与共识度**：
- 多参照高度一致（如工具三要素）→ 判定可信度高
- 单一参照得出的「有/无」→ 可能把单个产品的设计误当行业标准（初稿 method/headers 即此错）
- 参照要区分**层级**：工具「定义层」（name/description/schema）vs 「连接层」（url/method/headers）vs 「管理层」（category/status/version）——不同字段类型对照不同层级的标准，混层对照会得出错误判定

---

## 附：三个表单横向对照

| 维度 | Skill 表单 | MCP 表单 | 工具表单 |
|------|-----------|---------|---------|
| 参照锚点 | opencode Skills | MCP 协议 + opencode MCP | opencode Custom Tools + MCP/OpenAI |
| 标准字段 | name/description/instructions | name/type/command/url | name/description/parameters |
| 状态设计 | installed/available | connected/disconnected/error ❌ | active/disabled ✅ |
| 内联测试 | 无 | 菜单内 | **表单内 ✅** |
| Agent 路径保存 | 丢 7 字段 | 丢 7 字段 | 丢 4 字段（含 endpoint） |
| 版本字段 | 自加必填 ❌ | 自加必填 ❌ | 自加必填 ❌ |
| 最大加分 | — | 类型联动 | **测试按钮 + 状态设计** |
