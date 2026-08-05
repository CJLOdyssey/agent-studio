# 提示词 / 输出约束新建表单：设计合理性分析（2026-08-01）

> 按既定流程分析「新建提示词表单」（`PromptFormModal.tsx`）与「新建输出约束表单」（`OutputFormModal.tsx`）：
> ①确认要不要做 → ②5 要素描述 → ③定参照锚点 → ④逐字段设计合理性 → ⑤双挂载点 → ⑥消费链 → ⑦修复优先级。
>
> 支撑文件：`workstation/prompt/PromptFormModal.tsx`、`validate.ts`、`api.ts`、`types.ts`；`workstation/output/OutputFormModal.tsx`、`api.ts`、`output.types.ts`、`useOutputManagement.ts`；`backend/src/routers/prompts.py`、`backend/src/orm/content.py`、`backend/src/orm/agent.py`、`backend/src/tasks/agent_pipeline.py`。
>
> 参照锚点：提示词/prompt 的行业参照 = **Anthropic 官方 prompt engineering** + OpenAI prompt 规范 + MCP/Agent Skills 的 prompt 实体定义。

---

## 第 1 步 — 要不要做

| 表单 | 判断三问 | 结论 |
|------|---------|------|
| 提示词 | ①缺：Agent 需可复用 system prompt，避免手写 ②可测：内容拼进 system_prompt 可验证 ③拆半：name+content 即最小集 | ✅ 合理 |
| 输出约束 | ①缺：Agent 输出需格式/约束控制 ②可测：`agent_pipeline.py:109-110` 拼入 prompt 可验证 ③拆半：name+content 即最小集 | ⚠️ **功能合理但实现是孤岛**（见第 6 步） |

## 第 2 步 — 5 要素描述

**提示词表单**：运营/开发者在 Agent 配置时选择可复用 system prompt（用户/场景/目标）；填 name/category/model/status/version/content → 存 `prompts` 表 → Agent 引用其 id 拼入 system prompt（行为）；验收=运行时提示词生效。

**输出约束表单**：用户在独立「输出约束」tab 管理约束模板（用户/场景/目标）；填 name/content/category/status → 存 `prompts` 表 `category='output_constraint'`（行为）→ **应为 Agent 的 output_constraints 提供来源**（验收=Agent 运行时拼入输出约束）。

## 第 3 步 — 参照锚点（行业多源：3 个独立权威源）

初稿曾只写笼统参照（Anthropic/OpenAI prompt 规范），未实际拉取权威源。补拉后确认三个可验证的独立参照：

**锚点 1：MCP Prompts 规范**（https://modelcontextprotocol.io/docs/2026-07-28/learn/server-concepts.md，协议级定义）

MCP 的 prompt 实体 = **`name` + `description` + `arguments`（参数化模板）**：
- 「Prompts are structured templates that define expected inputs...」
- 「Clear descriptions of what each prompt does」——**description 是触发/选择依据**
- 「Natural argument input with validation」——**支持参数模板**

**锚点 2：Dify（提示词编排平台，langgenius/dify）**

- App 实体：`name` + `description`
- LLM 节点 prompt_template：`{role: system, text: ...}` + **变量参数 `{{ variable }}`**
- 提示词是**模板 + 变量**结构，可复用、可参数化

**锚点 3：Agent Skills 规范（agentskills.io，同前分析）**

`name` + `description` + 正文，**description 必填且是触发依据**。

### 三源共性结论（高可信度）

| 结论 | 验证 |
|------|------|
| prompt 实体 = name + content/description | 3/3 |
| **description 必填（触发/选择依据）** | MCP + Agent Skills 都强调 |
| **参数化模板（变量）** | MCP arguments + Dify `{{ var }}` |
| 无 version/status/category 强约束 | 3/3 |

**多源反衬的关键硬伤**：本项目提示词表单 **没有 description 字段、不支持变量参数**——
1. **缺 description**：MCP 和 Agent Skills 都要求 description 作为选择/触发依据，本项目 prompt 只有 name+content，Agent 弹窗选提示词时只能靠 name 猜内容
2. **缺参数化**：MCP arguments / Dify `{{ var }}` 都支持变量模板，本项目 content 是纯静态文本

### 字段对照表（多源）

**提示词表单（7 字段）**：

| 字段 | MCP | Dify | Agent Skills | 判定 |
|------|-----|------|-------------|------|
| 名称 * | ✅ name | ✅ name | ✅ name | **3/3，合理** |
| 内容 * | ✅ 模板正文 | ✅ text | ✅ 正文 | **3/3，合理（但缺参数化）** |
| — description | ✅ 必填 | ✅ | ✅ 必填 | **❌ 本项目缺失——3/3 源都有** |
| — arguments/变量 | ✅ | ✅ `{{var}}` | ✅ | **❌ 本项目缺失——3/3 源支持参数化** |
| 分类 | ❌ 无 | ⚠️ 有 | ❌ 无 | 管理组织层，合理但需枚举 |
| 模型 | ❌ 无 | ⚠️ 节点级有 | ❌ 无 | 自加但可疑 |
| 状态 | ❌ 无 | ❌ 无 | ❌ 无 | 自加，用户可控可接受 |
| 版本 * | ❌ 无 | ⚠️ 有 | ❌ 无 | **自加，必填不合理** |

**输出约束表单（5 字段）**：

| 字段 | 行业参照 | 判定 |
|------|---------|------|
| 名称 * | ✅ 标识 | 合理 |
| 内容 * | ✅ 约束正文 | 合理，核心 |
| 分类 | ❌ 无 | **语义错位**（见 O5） |
| 状态 | ❌ 无 | 自加，可接受 |
| （类型有 model/version 但表单不收） | — | **类型与表单不一致**（见 O4） |

## 第 4 步 — 逐字段设计合理性深度分析

### A. 提示词表单（PromptFormModal）

#### P1. 名称

- **设计动机**：提示词唯一标识，Agent 配置时选择。合理。
- **当前设计**：必填 input ≤50（`:43`）；`validate.ts:5-9` 非空 + ≥2 + ≤50 + 去重。
- **判定**：✅ **合理**。消费点明确，去重完备。与前三表单同标准。

#### P2. 内容 content

- **设计动机**：提示词正文，system prompt 的核心。行业标准字段。
- **当前设计**：必填 textarea，maxLength 5000（`:73`）；`validate.ts:10` 非空校验。
- **判定**：✅ **合理（核心）**。对齐 prompt 正文标准，必填正确。maxLength 5000 合理。
- **多源补充**：⚠️ **缺参数化**——MCP `arguments`、Dify `{{ variable }}` 都支持变量模板，本项目 content 是纯静态文本，无变量插入能力。System prompt 需要引用上下文的场景（如把当前团队/任务注入）做不了。

#### P2.5. 描述 description（多源新增，缺失字段）

- **设计动机**：提示词用途说明，Agent 弹窗选择时的触发/识别依据。
- **当前设计**：**表单无此字段**——只有 name 和 content。
- **判定**：❌ **缺失字段（3/3 源反衬）**。MCP「Clear descriptions of what each prompt does」、Agent Skills description 必填、Dify app 有 description。**本项目 Agent 弹窗选提示词时，只能看 name 猜内容**（`AgentManagement.tsx:31` 只展示 `{id, name}`）——没有 description，列表里 10 个提示词用户不知道哪个是干什么的。
- **修复**：补 description 必填字段，Agent 弹窗列表显示 name + description。

#### P3. 分类 category

- **设计动机**：提示词分类（system/prompt_category_output_constraint 等）。组织层。
- **当前设计**：select 枚举（`:48-50`），`PROMPT_CATEGORY_LABEL` 含 `output_constraint`（`constants.ts:17`）。
- **判定**：✅ **合理（用枚举）**。对比工具表单的自由文本，提示词用 select 枚举是正确做法。**但分类含 output_constraint 是设计隐患**——用户可在提示词管理直接建 output_constraint 分类的提示词，与「输出约束」模块重复（见 O1）。

#### P4. 模型 model

- **设计动机**：提示词绑定的目标模型。设计动机存疑——system prompt 通常是通用内容，不该绑定特定模型。
- **当前设计**：select（`:54-56`），`useModelOptions()` 从可用模型加载；默认 'GPT-4o'（`usePromptManagement.ts:9`）。
- **判定**：⚠️ **可疑字段**。三个问题：
  1. **默认值 'GPT-4o' 是硬编码**——若实际模型池里没有 GPT-4o，用户看到的是不存在的选项
  2. **后端 PromptCreate 没有 model 必填**（`prompts.py:21` model 可空），前端默认填一个
  3. **消费点存疑**——需确认 model 是否真的在运行时按模型筛选提示词（后端 agent_pipeline 未发现按 model 过滤提示词的逻辑）
- **竞品对比**：prompt 标准无 model 字段。**应删或明确消费点**。

#### P5. 状态 status

- **设计动机**：active/draft/archived 启停控制。用户可控。
- **当前设计**：select（`:62-64`）；`api.ts:12` 映射 active→active 否则 draft。
- **判定**：✅ **合理**。active/draft/archived 是用户可控的意图状态（同工具表单 active/disabled 设计）。

#### P6. 版本 version

- **设计动机**：提示词版本号。**同前三表单，自加存疑**。
- **当前设计**：必填 input，占位 v1.0.0（`:68`）；`validate.ts:11` 校验 `/^v\d+\.\d+\.\d+$/`。
- **判定**：❌ **必填不合理**。同 Skill/MCP/Tool：90% 填 v1.0.0、无更新来源、竞品无此字段。**且后端 PromptCreate 根本没有 version 字段**（`prompts.py:17-22`）——前端必填校验的字段，后端 schema 不收，纯前端自嗨。

#### P7. 加分项

- **Escape 关闭**（`:18-24`）：表单内注册 Escape 键关闭，比 MCP/Skill 表单（backdrop 点击）多一个正确入口。✅
- **role="dialog" aria-modal**（`:27`）：无障碍标记完备。✅

### B. 输出约束表单（OutputFormModal）

#### O1. 模块定位问题：输出约束是「提示词的子集」而非独立实体（P0）

- **证据**：`output/api.ts:25` `listPrompts().filter(p => p.category === 'output_constraint')`——输出约束管理就是「提示词管理按 category 过滤」的视图。
- **问题**：两个表单（PromptFormModal + OutputFormModal）操作**同一张 prompts 表**，分类系统内建了 `output_constraint`。用户可以在「提示词管理」里建 output_constraint 分类的条目，也能在「输出约束」tab 建——**两条入口产生同一类数据，无排重**。
- **判定**：模块职责边界模糊。要么输出约束独立成实体（建独立表），要么明确它是 prompt 的过滤视图（隐藏 category 选择）。

#### O2. 名称

- **设计动机**：约束唯一标识。合理。
- **当前设计**：必填 input ≤50（`:34`）；`validate.ts` 同提示词。
- **判定**：✅ **合理**。

#### O3. 内容 content

- **设计动机**：输出约束正文。核心。
- **当前设计**：必填 textarea（`:38`）；保存按钮 disabled 依赖 `!formData.name.trim() || !formData.content.trim()`（`:55`）。
- **判定**：✅ **合理**。且**保存按钮 disabled 前置校验是加分项**——三表单中唯一在按钮层拦截空值。

#### O4. 类型与表单不一致：model/version 在类型里但表单不收（P1）

- **证据**：`output.types.ts:9-11` OutputEntry 含 `model: string`、`version: string`，但 OutputFormModal **表单没有这两个字段**。
- **问题**：`output/api.ts:16-18` `toEntry` 里 `model: ''`（**永远空**）、`version: item.version`（来自 prompts 表）。类型声明了不存在的字段，`model` 被硬编码空串。
- **判定**：类型定义与表单不一致——**模型字段在输出约束里根本没意义，应在类型中删除**，或表单补齐。

#### O5. 分类字段：存进 model 字段的语义错位（P0）

- **证据**：`output/api.ts:31` `createPrompt({ name, category: 'output_constraint', content, model: data.category })`——**把用户填的「分类」存进 prompts 表的 model 字段**。
- **问题链**：
  1. `output.types.ts:15` `category: (item.model || '')`（`:15`）——回读时又从 model 取出当 category
  2. `OutputFormModal.tsx:43` 分类是自由文本 input（占位「格式约束」）
  3. **前后端字段语义双重错位**：UI 叫「分类」，存成 model，读回变 category。改一处必乱。
- **判定**：❌ **严重设计缺陷**。分类字段用错误的存储位置（model），一旦别的逻辑按 model 筛选提示词（AgentManagement.tsx:31 就按 category 过滤），会混入输出约束数据。应存 category 字段或删除分类。

#### O6. 状态

- **设计动机**：active/draft/archived。
- **当前设计**：select（`:47-49`）。
- **判定**：⚠️ **存疑**。`output/api.ts:17` `toEntry` 里 `status: 'active'` **硬编码**——表单的 status 选择回读时永远 active，编辑保存后 status 选择无效。**表单字段与数据映射脱节**（同 O4 同源问题）。

#### O7. 单挂载点

- **确认**：OutputFormModal 仅 `OutputConstraintManagement.tsx:116` 一处挂载（codegraph 核实）——无 Agent 弹窗路径，**不存在 MCP/Skill/Tool 的双挂载点丢字段问题**。✅ 加分。

## 第 5 步 — 双挂载点

| 表单 | 挂载点 | 双挂载问题 |
|------|--------|-----------|
| PromptFormModal | `PromptManagement.tsx`（单挂载） | 无（codegraph 确认 2 callers 均为 PromptManagement 内部） |
| OutputFormModal | `OutputConstraintManagement.tsx`（单挂载） | 无 |

**对比前三表单（Skill/MCP/Tool 都有 Agent 弹窗双挂载 + 丢字段问题），prompt/output 表单无此问题**——因为它们是独立管理模块，没被 Agent 弹窗的 ItemEditor 复用。✅ 加分。

## 第 6 步 — 消费链与字段去向（反向追踪）

### 提示词消费链

```
PromptFormModal 收集
  name/category/content/status  → api.ts:20 → prompts 表 → Agent 弹窗选择 → 拼入 system prompt  消费 ✅
  model                        → api.ts:20 → prompts 表 → 无按 model 筛选逻辑                      消费 ❌ 可疑
  version                      → api.ts:20 → prompts 表 → 后端 schema 无此字段                     消费 ❌ 断裂
```

**关键发现**：
1. `model` 字段消费点存疑——后端 `agent_pipeline.py` 无按模型过滤提示词的逻辑
2. `version` 后端 schema（`prompts.py:17-22`）**根本不存在**——前端必填校验的字段后端不收

### 输出约束消费链（孤岛）

```
OutputFormModal 收集
  name/content/category/status → output/api.ts:31 → prompts 表(category=output_constraint, 分类存 model)
                                                   ↓
  Agent 的 output_constraints  ← Agent 弹窗单独填写（orm/agent.py:91）→ agent_pipeline.py:109 消费 ✅
                   ✗ 没有任何代码把 output_constraint 的 prompt 连到 Agent.output_constraints
```

**最严重发现**：**输出约束管理模块是「孤岛」**——
- 管理模块创建的约束存进 prompts 表（category=output_constraint）
- Agent 的 `output_constraints` 是**独立字段**，由 Agent 弹窗直接填（`agents.py:30`）
- **后端没有任何代码连接两者**——`agent_pipeline.py:109-110` 只读 `ac.output_constraints`（Agent 配置），从不查 prompts 表的 output_constraint
- **用户管理「输出约束」tab 建的模板，运行期完全不被使用**。用户以为在管理约束，实际在管理死数据

## 第 7 步 — 修复优先级

| 优先级 | 编号 | 问题 | 建议 |
|--------|------|------|------|
| P0 | 孤岛 | 输出约束管理数据运行期不消费 | 建立连接：Agent 弹窗的 output_constraints 改为从 output_constraint prompts 选择，或约束 tab 改为管理 Agent 的 output_constraints |
| P0 | O5 | 分类存进 model 字段（语义错位） | 输出约束若无分类概念就删字段；若有则存 category 而非 model |
| P1 | P2.5 | **提示词缺 description（3/3 源反衬）** | 补必填 description，Agent 弹窗列表显示 name + description |
| P1 | P2 | 提示词内容缺参数化（MCP arguments / Dify `{{var}}`） | 支持变量模板或说明不支持的原因 |
| P1 | O4/O6 | 类型含 model/version 但表单不收；status 硬编码 active | 类型与表单对齐；status 映射修正 |
| P1 | P4 | 提示词 model 字段消费点存疑 + 默认 'GPT-4o' 硬编码 | 确认或删除 model 字段；默认值改为实际模型池首项 |
| P1 | O1 | 输出约束与提示词双入口建同 category 数据 | 明确模块关系：独立表 或 过滤视图（隐藏分类选择） |
| P2 | P6 | 版本必填 + 后端 schema 无此字段 | 后端补 version 或前端取消必填 |
| P2 | — | 输出约束无测试按钮 | 对比工具表单加分项，可加内容预览 |

## 健康形态建议

```
提示词表单最小集：名称 * | 描述 * | 内容 * | 分类(枚举，去掉 output_constraint)
  新增：description（Agent 弹窗选择依据）、可选变量参数
  移除：版本（后端不收）、model（无消费点）
  保留：状态(active/draft/archived 用户可控)

输出约束表单最小集：名称 * | 内容 *
  移除：分类（语义错位）、状态（硬编码无效）
  修正：连接 Agent.output_constraints 消费链，或并入提示词模块作过滤视图
```

## 结论

**提示词表单**（多源修正后）：核心字段 content 正确、用枚举分类（加分）、Escape 关闭+无障碍（加分）、无双挂载问题（加分）。**硬伤从 2 处增至 4 处**（多源反衬）：
1. `version` 后端 schema 不收（前端必填自嗨）
2. `model` 默认值硬编码 + 消费点存疑
3. **缺 description（3/3 源反衬）**——Agent 弹窗选提示词只能靠 name 猜内容
4. **缺参数化（MCP/Dify 都支持变量模板）**

**输出约束表单**（2/5 字段合理）：**四表单中问题最严重**：
1. **孤岛**——管理的数据运行期不消费（P0）
2. **分类存进 model 字段**——前后端语义双重错位（P0）
3. **类型与表单不一致**——model/version 声明了不收，status 硬编码（P1）
4. **双入口数据重复**——与提示词的 output_constraint 分类重叠（P1）

加分项：保存按钮前置 disabled 校验（O3）、单挂载无丢字段问题（O7）。

**横向对比**：工具表单质量最高（测试按钮+正确状态设计）> 提示词（核心字段正确+缺 description/参数化）> MCP（形态错误+双挂载丢字段）> 输出约束（孤岛+语义错位）。

---

## 附：五个表单横向对照

| 维度 | Skill | MCP | 工具 | 提示词 | 输出约束 |
|------|-------|-----|------|--------|---------|
| 核心字段 | instructions | command/url | parameters | content | content |
| description | ❌ 选填 | ❌ 无 | ❌ 选填 | **❌ 缺失** | ❌ 无 |
| 参数化/变量 | — | — | JSON Schema | **❌ 缺失** | — |
| 版本字段 | 自加必填 ❌ | 自加必填 ❌ | 自加必填 ❌ | 后端不收 ❌ | 类型有表单无 |
| 状态设计 | installed/available | 三态 ❌ | active/disabled ✅ | active/draft ✅ | 硬编码无效 ❌ |
| 测试/预览 | 无 | 菜单内 | 表单内 ✅ | 无 | 无 |
| 双挂载丢字段 | 丢 7 | 丢 7 | 丢 4 | 无 ✅ | 无 ✅ |
| 数据消费 | 运行期消费 | 运行期消费 | 运行期消费 | 运行期消费 | **孤岛 ❌** |
| 最严重问题 | 描述选填 | 状态形态错 | method/headers 缺 | **缺 description + version 后端不收** | **数据不消费 + 字段错位** |

---

## 附 2：多源参照修正记录

初稿参照章节只写了笼统的「Anthropic/OpenAI prompt 规范」+「Agent Skills/MCP」，**未实际拉取权威源**，违反多源原则。已补拉三个可验证参照：
1. **MCP Prompts 规范**（server-concepts 文档）——prompt = name + description + arguments
2. **Dify**（langgenius/dify 源码）——app 有 name + description，prompt_template 支持 `{{ var }}`
3. **Agent Skills 规范**（agentskills.io，复用前分析）

多源修正：**提示词表单新增 2 处硬伤**（缺 description、缺参数化），结论从「6/7 字段合理」修正为「4/7 + 2 缺失字段」。

方法论意义：**提示词是「模板」实体（可复用 + 可参数化 + 可描述），不是「配置」实体**——只用 name+content 定义提示词，等于把它降级成静态文本。多源参照能暴露「缺失字段」（description/参数化），这是单一参照容易漏的。
