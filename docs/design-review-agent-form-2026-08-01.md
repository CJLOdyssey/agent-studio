# Agent 创建表单：设计合理性分析（2026-08-01）

> 按既定流程分析「新建 Agent 表单」。Agent 有两个表单入口：
> - **工作站 AgentFormModal**（`workstation/agent/AgentFormModal.tsx`，149 行）——新建 Agent 列表项
> - **AgentConfigModal**（`modals/AgentConfigModal.tsx`，214 行）——配置 Agent 弹窗（system/output/tools/mcp/skills 五 tab）
>
> 支撑文件：`AgentFormModal.tsx`、`validate.ts`、`agent.types.ts`、`api.ts`、`mappers.ts`、`ResourcePickerSection.tsx`、`AgentConfigModal.tsx`、`backend/src/orm/agent.py`、`backend/src/routers/agents.py`、`backend/src/tasks/agent_pipeline.py`。
>
> 参照锚点：Agent 定义行业标准 = **Anthropic building-effective-agents**（已拉）+ **Dify agent 配置**（已拉，agent 有 name/description/system_prompt/tools/model）+ OpenAI/Anthropic assistant。

---

## 第 1 步 — 要不要做

判断三问：
1. 不做它用户损失什么？—— **有**。AgentStudio 核心是 Agent 编排，无 Agent 创建则系统不可用。
2. 验收标准可测吗？—— 可测。`agent_pipeline.py` 运行时用 system_prompt + tools 执行可验证。
3. 拆掉一半核心价值还在吗？—— 在。name + systemPrompt + tools 即最小可用集。

**结论：合理功能，且是系统核心。**

## 第 2 步 — 5 要素描述

**用户**：运维/开发者。**场景**：需让 Agent 按角色执行任务时。**目标**：定义 Agent 的名称/角色/模型/提示词/工具绑定。**行为**：填 name/description/team/model/version/status/systemPromptId/toolIds/mcpIds/skillIds → 存 AgentConfigDB → 运行时按 system_prompt+tools 执行。**验收**：创建后 Agent 可运行，提示词与工具生效。

## 第 3 步 — 参照锚点（行业多源）

Agent 定义行业参照——核心是 **role（角色）+ system_prompt + tools**：

**锚点 1：Anthropic building-effective-agents**（https://www.anthropic.com/engineering/building-effective-agents）
「Agent = LLM + tools，基于环境反馈循环决策」。Agent 的本质三要素：**LLM（model）+ 指令（system prompt）+ 工具**。

**锚点 2：Dify Agent 配置**（langgenius/dify，已拉）
- agent/app：`name` + `description` + `system_prompt`（LLM 节点）+ `model` + `tools`
- 角色（role）体现在 system prompt 或 agent 描述中

**锚点 3：OpenAI/Anthropic Assistant API 共识**
- assistant = `name` + `instructions`（system prompt）+ `model` + `tools`

**三源共性**：Agent 定义标准字段 = **name + system_prompt（指令）+ model + tools**。role 是 system prompt 的语义内容而非独立强字段。**无 version/status 强约束**。

### 字段对照表（工作站 AgentFormModal，10 字段）

| 字段 | Anthropic | Dify | OpenAI | 判定 |
|------|-----------|------|--------|------|
| 名称 * | ✅ | ✅ | ✅ | **3/3，合理** |
| systemPromptId * | ✅ 指令 | ✅ system_prompt | ✅ instructions | **3/3，合理（核心）** |
| 模型 model | ✅ LLM | ✅ model | ✅ model | **3/3，合理** |
| tools/skills/mcp | ✅ tools | ✅ tools | ✅ tools | **3/3，合理（工具绑定）** |
| 团队 team | ⚠️ | ✅ 应用归属 | ❌ | 自加组织层，合理 |
| 描述 description | ⚠️ 选填 | ✅ | ✅ | 合理（弱消费） |
| 版本 version | ❌ 无 | ⚠️ 有 | ❌ | **自加，必填不合理** |
| 状态 status | ❌ 无 | ❌ 无 | ❌ | 自加，用户可控可接受 |

## 第 4 步 — 逐字段设计合理性深度分析

#### A1. 名称

- **设计动机**：Agent 唯一标识。行业标准字段。合理。
- **当前设计**：必填 input ≤30（`AgentFormModal.tsx:79`）；`validate.ts:6-10` 非空 + ≥2 + ≤30 + 去重。
- **判定**：✅ **合理**。注意上限 30 比前几表单（50）更短，但 agent 名通常短，可接受。
- **加分**：`AgentConfigModal.tsx:173` 名称输入有占位「新 Agent」。

#### A2. 系统提示词 systemPromptId

- **设计动机**：Agent 的指令核心，运行时拼入 system prompt。行业标准字段。
- **当前设计**：必填（`validate.ts:12`），经 ResourcePickerSection 从可用提示词选择（`ResourcePickerSection.tsx:64-65`）。
- **判定**：✅ **合理（核心）**。但**联动瑕疵**：`AgentManagement.tsx:31` 拉取提示词时 `filter(p => p.category !== 'output_constraint')`——**排除了输出约束分类**。合理（输出约束不是 system prompt）。但用户选提示词时列表只显示 name（`{id, name}`），**没有 description**——上一轮提示词分析已指出缺 description 的连锁影响。

#### A3. 模型 model

- **设计动机**：Agent 运行的 LLM。行业标准字段。
- **当前设计**：select（`AgentFormModal.tsx:95-97`），`useModelOptions()` 从可用模型加载。
- **判定**：✅ **合理**，且**有联动修正加分**（`AgentFormModal.tsx:43-48`）：创建时默认 model 若不在可用列表，自动对齐第一个。**这是前五表单中唯一处理「默认值不存在于选项池」问题的表单**。
- **对照**：提示词表单的 model 默认 'GPT-4o' 硬编码无此保护，Agent 表单修正了此问题。

#### A4. 团队 team

- **设计动机**：Agent 归属团队。组织层字段。
- **当前设计**：select（`:88-91`），从 `listTeams()` 加载（`:37-39`）。
- **判定**：✅ **合理**。选项来自真实团队列表，非硬编码。但默认值 `'前端团队'`（`useAgentManagement.ts:9`）**硬编码**——若不存在「前端团队」，选项不在列表里，select value 指向不存在的 option。

#### A5. 描述 description

- **设计动机**：Agent 用途说明。
- **当前设计**：选填 textarea ≤200（`:82-83`）。
- **判定**：⚠️ **弱消费 + 字段滥用**（见 A10）——描述被存进 output_constraints JSON（`api.ts:50`），而不是独立 description 字段。

#### A6. 版本 version

- **设计动机**：Agent 版本号。同前五表单，自加存疑。
- **当前设计**：input（`:100-101`，**非必填**）；`validate.ts:11` 仍校验格式 `/^v\d+\.\d+\.\d+$/`。
- **判定**：⚠️ **校验与必填不一致**——非必填但填了就强制格式。对比前几表单（必填），Agent 表单**版本选填是改进**。但仍无更新来源、竞品无此字段。

#### A7. 状态 status

- **设计动机**：running/stopped/error 运行态。
- **当前设计**：select（`:105-107`）；`api.ts:60` `is_active: data.status === 'running'`。
- **判定**：⚠️ **概念混用**。`running/stopped/error` 是**运行时探测状态**（同 MCP 的连接三态问题），但 `api.ts:60` 把「running」映射到 `is_active`（用户意图启停）——**运行时状态和意图状态混在一个字段**。新建时用户不可能知道 Agent 是否 running。创建场景下 `stopped` 是唯一合理默认，但表单给了 running 选项（选了也存成 is_active=true 而已）。

#### A8. 资源绑定（tools/mcp/skills）

- **设计动机**：Agent 可用的工具集。行业标准字段（tools）。
- **当前设计**：ResourcePickerSection 多选 picker（`:112-125`），chips 展示。
- **判定**：✅ **合理**。多选 picker + 已选 chips 展示是标准模式。**但**：
  - `matchByIdOrName`（`:50-51`）用 id 或 name 匹配——名字改了就丢，同 MCP 的 id 用 name 顶替问题
  - `AgentManagement.tsx:32-38` 合并 tools 和 tool plugins，mcp/skills 单独拉取——**加载失败全部静默 `.catch(() => {})`**，用户看到空列表以为没有可用资源

#### A9. AgentConfigModal 加分项（对照工作站表单）

- **五 tab 分组**（`:26-32`）：system/output/tools/mcp/skills——**这是全项目唯一把配置合理分组的表单**
- **自动保存**（`:79-80` useAutoSave）：配置即存
- **焦点管理 + Tab 循环**（`:37-68`）：无障碍完备（全项目最佳）
- **tab 计数徽章**（`:183-186`）：tools/mcp/skills 数量展示

#### A10. 最严重缺陷：output_constraints 被滥用为「元数据打包」（P0）

- **位置**：`api.ts:50-55`（create）、`:87-92`（update）
- **证据**：创建 Agent 时把 `description / team / version / systemPromptId` **全部塞进 `output_constraints` JSON**：
  ```js
  output_constraints: JSON.stringify({
    description: data.description,
    team: data.team,
    version: data.version,
    systemPromptId: data.systemPromptId,
  })
  ```
- **问题链**：
  1. `agent_pipeline.py:108-110` 运行时 `system_prompt += f"\n\n输出约束：{ac.output_constraints}"`——**整个 JSON 字符串被当输出约束注入 system prompt**！
  2. 用户填的「团队」「版本」会以 `{"description":"...","team":"前端团队","version":"v1.0.0","systemPromptId":"..."}` 的形式**拼进 LLM 的 system prompt**
  3. 与「输出约束」模块（上一轮分析）**双重错位**：Agent 的 output_constraints 既是"输出约束"又是"元数据仓库"，而输出约束管理模块的数据运行期却不消费
- **判定**：❌ **严重字段语义错位**。正确做法：description/team 存独立列（后端 `orm/agent.py` 有 role/description 概念），output_constraints 只存真正的输出约束文本。

#### A11. 缺 role（角色）字段（多源反衬）

- **证据**：后端 `orm/agent.py:70` 有 `role` 列（默认「待配置角色」）、`role_identifier` 列（`orm/agent.py:87`）、`AgentConfigModal` 有 role 输入（`:76`）。**但工作站 AgentFormModal 表单没有 role 字段**。
- **判定**：⚠️ **两表单字段不一致**。Anthropic 三源都强调 Agent 有 role/指令身份，工作站表单缺 role，AgentConfigModal 有。新建的 Agent role 永远默认「待配置角色」，需再进弹窗补。

## 第 5 步 — 双挂载点

| 表单 | 挂载点 | 问题 |
|------|--------|------|
| AgentFormModal | `AgentManagement.tsx:158-162`（单挂载） | 无双挂载丢字段 |
| AgentConfigModal | 从列表行配置入口（`useWorkstationState.ts`） | 无 |

**对比**：Agent 表单无双挂载问题（工作站和弹窗是不同组件，非同一组件双挂载）。✅

## 第 6 步 — 消费链与字段去向（反向追踪）

```
AgentFormModal 收集
  name/team/model/status  → api.ts:44-64 → AgentConfigDB   → 列表展示             消费 ✅
  systemPromptId          → api.ts:37   → resolveLists → system_prompt 列 → agent_pipeline:108  消费 ✅
  toolIds/mcpIds/skillIds → api.ts:38-42 → resolveLists → tools/mcp/skills 列 → agent_pipeline:190-312  消费 ✅
  description/team/version→ api.ts:50-55 → output_constraints JSON → agent_pipeline:110  消费 ⚠️ 但语义错位!
  model                   → api.ts:63   → model 列         → LLM 调用               消费 ✅
  status(running)         → api.ts:60   → is_active        → 运行控制               消费 ✅（概念混用）
```

**关键发现**：
1. **`output_constraints` 双重错位**（P0）：description/team/version 打包进去，运行时整个 JSON 被当输出约束注入 system prompt
2. `agent_pipeline.py:109-110`：`if ac.output_constraints` 非空即追加——**只要填了描述/团队/版本，就一定会把 JSON 注入提示词**
3. 与「输出约束」模块关系：Agent 的 output_constraints 独立于输出约束管理模块，两处都对 output_constraints 有概念但互不关联

## 第 7 步 — 修复优先级

| 优先级 | 编号 | 问题 | 建议 |
|--------|------|------|------|
| P0 | A10 | output_constraints 被滥用存 description/team/version | description/team 存独立列；output_constraints 只存真输出约束 |
| P1 | A7 | 状态 running/stopped/error 混用运行时态与意图态 | 新建默认 stopped 且不提供 running；is_active 与 status 分离 |
| P1 | A11 | 工作站表单缺 role 字段 | 补 role 输入（后端已有 role 列） |
| P1 | A8 | 资源 picker 用 id/name 混合匹配 | 统一用 id，补加载失败提示 |
| P2 | A6 | version 非必填但强制格式 | 校验与必填对齐，或删字段 |
| P2 | A4 | team 默认 '前端团队' 硬编码 | 默认空，从列表选 |

## 健康形态建议

```
Agent 表单最小集（对齐三源）：名称 * | role * | systemPrompt * | model | tools
  保留：团队（组织层，默认空）、状态（意图启停，新建默认 stopped）
  修复：output_constraints 不存元数据、补 role
  移除：版本（无更新来源）或取消格式校验
  加分沿用：model 联动修正、五 tab 分组、自动保存、焦点管理
```

## 结论

Agent 表单**设计质量高**（全项目最佳表单之一）：
- ✅ **多源对齐**：name + systemPrompt + model + tools 全部对齐 Anthropic/Dify/OpenAI
- ✅ **加分项最多**：model 联动修正（唯一处理默认值缺失）、五 tab 分组（唯一合理分组）、自动保存、焦点管理+Tab 循环（无障碍最佳）、资源绑定 chips
- ✅ **无双挂载问题**、状态非必填版本（相对改进）

但有一个 **P0 级严重缺陷（A10）**：**`output_constraints` 被滥用为元数据打包**——`api.ts:50-55` 把 description/team/version/systemPromptId 塞进 output_constraints JSON，运行时 `agent_pipeline.py:110` 把整个 JSON 当输出约束注入 system prompt。**用户填的团队名、版本号会以 JSON 形式出现在 LLM 提示词里**。

这个缺陷把前几轮分析串起来了：
- 提示词/输出约束分析发现「输出约束管理模块是孤岛」
- Agent 表单这里发现「output_constraints 被塞了元数据」
- **两处共同指向：output_constraints 字段语义混乱，需要一次集中治理**——独立列存真输出约束 + description/team 独立存 + 输出约束模块建立真实消费链

---

## 附：六个表单横向对照

| 维度 | Skill | MCP | 工具 | 提示词 | 输出约束 | **Agent** |
|------|-------|-----|------|--------|---------|-----------|
| 核心字段 | instructions | command/url | parameters | content | content | **systemPrompt+tools** |
| 多源对齐 | 3/9 | 5/9 | 4/8 | 4/7 | 2/5 | **5/10 ✅** |
| 版本字段 | 必填 ❌ | 必填 ❌ | 必填 ❌ | 后端不收 ❌ | 类型有表单无 | **选填+强制格式** ⚠️ |
| 状态设计 | installed/available | 三态 ❌ | active/disabled ✅ | active/draft ✅ | 硬编码 ❌ | **三态混用** ⚠️ |
| 分组 | 无 | 无 | 无 | 无 | 无 | **五 tab ✅** |
| 联动/自动 | — | 类型联动 | — | — | — | **model 联动+自动保存 ✅** |
| 测试/预览 | 无 | 菜单内 | 表单内 ✅ | 无 | 无 | 菜单内测试 |
| 双挂载丢字段 | 丢 7 | 丢 7 | 丢 4 | 无 ✅ | 无 ✅ | 无 ✅ |
| 最严重问题 | 描述选填 | 状态形态错 | method/headers 缺 | 缺 description | 数据不消费 | **output_constraints 塞元数据注入提示词** |

---

## 附 2：参照来源

| 来源 | 地址 |
|------|------|
| Anthropic 构建有效 Agent | https://www.anthropic.com/engineering/building-effective-agents |
| Dify agent 配置 | https://github.com/langgenius/dify |
| Agent Skills 规范 | https://agentskills.io/specification |
| MCP Prompts 规范 | https://modelcontextprotocol.io/docs/2026-07-28/learn/server-concepts.md |
