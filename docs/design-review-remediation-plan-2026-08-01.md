# 八个表单/编辑器审查 → 修复 + 优化执行方案（2026-08-01）

> 承接 8 份分析文档，把全部发现收敛为**可执行的修复 + 优化方案**。本文聚焦「修什么、怎么修、先修谁」：
>
> - **第一部分**：跨表单交叉问题（4 个系统性缺陷，一改治愈多处）
> - **第二部分**：分功能修复清单（P0/P1/P2 具体到文件）
> - **第三部分**：优化推广（把各表单的加分项横向复制）
> - **第四部分**：分期路线图
>
> 分析依据：`docs/design-review-{skill,mcp,tool,prompt-output,agent,team,workflow}-*.md`

---

# 第一部分：跨表单交叉问题（最高优先，一改治愈多处）

## X1. `output_constraints` 字段语义全面失控（P0）

**涉及**：Agent 表单 + 输出约束模块 + 运行时代码。这是全项目最严重的系统性缺陷。

**证据链**：
```
Agent api.ts:50-55   → 把 description/team/version/systemPromptId 塞进 output_constraints JSON
output/api.ts:31     → 输出约束模块把「分类」塞进 prompts.model 字段
agent_pipeline.py:110→ 运行时把整个 output_constraints 当「输出约束」注入 system prompt
output/api.ts:25     → 输出约束模块创建的数据，后端无任何代码消费（孤岛）
```

**后果**：用户填的团队名/版本号会以 `{"team":"前端团队","version":"v1.0.0"...}` 形式出现在 LLM 提示词里；输出约束管理 tab 建的数据运行期被无视。

**修复方案**（三步，独立实施）：
1. **X1-a**：`agent/api.ts:50-55,87-92` 移除元数据打包——description/team 用 Agent 真实字段存（后端 `orm/agent.py` 已有对应概念），`output_constraints` 只存用户真正填的输出约束文本
2. **X1-b**：`output/api.ts:31` 停止把「分类」存进 `model` 字段——输出约束若无分类概念删字段，若有则存 category
3. **X1-c**：建立真实消费链——Agent 的 output_constraints 改为从 output_constraint prompts 选择，或约束 tab 改为管理 Agent 的 output_constraints（二选一，明确职责）

**验收**：创建 Agent 后 system prompt 不含 `{"team":...}` 元数据；输出约束 tab 建的数据运行时生效。

## X2. 版本字段：7 个表单全部有问题（P1）

**证据**：5 个 validate.ts 有相同正则 `/^v\d+\.\d+\.\d+$/`；但后端 `prompts.py:17-22` 的 PromptCreate 无 version 字段；`MCPFormModal` version 存进 config JSON 无独立列；无任何表单有「版本更新来源」。

**⚠️ 修正（v2）**：初稿建议直接删字段，**漏了版本快照机制的副作用**——`mcp/tool/skill/agent/prompt/team` 六模块都有 `_snapshot_mcp`/`create_version` 快照（`mcps.py:46`、`tools.py:117`），快照里记录 `version`。直接删字段会：
- 快照记录的 version 变空/undefined
- 版本历史弹窗（VersionHistoryModal）展示损坏

**统一修复**（考虑快照机制，二选一）：
- **方案 A（推荐）**：前端删除必填/输入，改为**只读展示 + 后端自动递增**（每次编辑 +1）——快照机制保留且有真实数据来源
- **方案 B**：前端取消必填、保留输入框，快照容忍空值

**涉及文件**：`skill/mcp/tool/prompt/agent/validate.ts` + 各表单/类型定义 + 快照逻辑（保留）。

## X3. 双挂载点静默丢字段（P0，Skill/MCP/Tool 三处同源）

**证据**：`useConfigItemEdit.ts` `saveFormItem` 三处只保存子集：
- `case 'tool'`（`:153-162`）：丢 endpoint/category/status/version
- `case 'mcp'`（`:164-174`）：丢 type/command/url/args/env/version/status（7 个）
- `case 'skill'`（`:175-185`）：丢 category/status/version/instructions/tool_names/output_constraint（7 个）

**修复**：Agent 弹窗内的新建/编辑走完整 API（同工作站路径），或声明该路径只支持简配并在 UI 明示。

**验收**：Agent 弹窗内新建 Tool 后 endpoint 保留；新建 MCP 后 command/env 保留；新建 Skill 后 instructions 保留。

## X4. 资源 id 用 name 顶替（P1，三处同源）

**证据**：`agent/ResourcePickerSection.tsx:50-51` `matchByIdOrName`（id 或 name 匹配）；`workflow/WorkflowEditor.tsx:250` 节点 `id: agent.name`；MCP 分析中 `{id: t.name, name: t.name}`。

**修复**：统一用真实 id（agentConfigId/tool id）作唯一键，name 只作展示。

---

# 第二部分：分功能修复清单

## 2.1 Skill 表单

| 优先级 | 问题 | 修复 |
|--------|------|------|
| P0 | 描述选填（违反 3/3 标准） | `skill/SkillFormModal.tsx` 描述改必填 |
| P0 | X3 双挂载丢 7 字段 | 见 X3 |
| P1 | name 校验不符 lowercase-hyphen | **⚠️ 区分场景**：项目有 SKILL.md 导入功能（`skills.py:138` 从 Anthropic Agent Skills 导入，`skill_agent/validator.py` 校验 frontmatter）——**导入的 SKILL.md 必须 lowercase-hyphen**（目录名约束）；但**手动新建的表单是数据库实体、当前鼓励中文名**（占位「前端开发」）。建议：新建时校验可选（提示转换），导入时强制校验 |
| P1 | tool_names 前后端割裂（MCP 名塞进工具名数组） | 拆分 tool_names + mcp_names 或判别式联合类型 |
| P1 | 三个裸 fetch 绕过 API 层（`:31-39`） | 换统一 API client，补 loading/error |
| P2 | X2 版本字段 | 见 X2 |
| P2 | constraint picker 不回显已选（`:196 selectedIds={[]}`） | 传真实 selectedIds |

## 2.2 MCP 表单

| 优先级 | 问题 | 修复 |
|--------|------|------|
| P0 | X3 双挂载丢 7 字段 | 见 X3 |
| P0 | 状态三态让用户填系统值（`MCPFormModal.tsx:47`） | 移除；用 enabled 开关 + `/test` 回写 status |
| P1 | env 文本 `\n` 切分无格式校验 | 结构化 key-value 编辑（对齐竞品） |
| P1 | 缺 cwd/timeout/headers 字段 | 对照 opencode 补齐；**⚠️ 需同步后端改造**（当前 `mcps.py:169,186` 测试用硬编码 10.0/5.0，无字段存储/消费） |
| P1 | `/test` 不回写 status | `mcps.py:150` MCPTestResult 补 status 输出 |
| P2 | X2 版本字段 | 见 X2 |

## 2.3 工具表单

| 优先级 | 问题 | 修复 |
|--------|------|------|
| P0 | X3 双挂载丢 endpoint | 见 X3 |
| P0 | method/headers 采集断裂（ORM 有列、表单无入口） | `tool/ToolFormModal.tsx` 补 method select + headers |
| P1 | parameters 无 JSON 校验 | `tool/validate.ts` 加 JSON.parse 校验 |
| P1 | description 选填（LLM 选工具依据） | 改必填 |
| P1 | category 自由文本无枚举 | 枚举或从已有分类选择 |
| P2 | X2 版本字段 | 见 X2 |

## 2.4 提示词表单

| 优先级 | 问题 | 修复 |
|--------|------|------|
| P0 | 缺 description（3/3 源反衬） | `prompt/PromptFormModal.tsx` 补必填 description |
| P0 | version 后端 schema 不收 | `prompts.py` 补 version 或前端删字段（见 X2） |
| P1 | 缺参数化（MCP arguments/Dify `{{var}}`） | content 支持变量模板 |
| P1 | model 默认 'GPT-4o' 硬编码无联动修正 | 复用 Agent 表单的 model 对齐逻辑 |
| P2 | 分类含 output_constraint 与输出约束模块重复 | 明确模块关系（见 X1-c） |

## 2.5 输出约束表单

| 优先级 | 问题 | 修复 |
|--------|------|------|
| P0 | X1 数据孤岛（运行期不消费） | 见 X1-c |
| P0 | X1 分类存进 model 字段 | 见 X1-b |
| P1 | 类型含 model/version 但表单不收 | `output/output.types.ts` 对齐表单 |
| P1 | status 硬编码 active（`output/api.ts:17`） | status 映射修正 |

## 2.6 Agent 表单

| 优先级 | 问题 | 修复 |
|--------|------|------|
| P0 | X1 output_constraints 塞元数据注入提示词 | 见 X1-a |
| P1 | status 三态混用运行时态与意图态 | 新建默认 stopped 且不提供 running |
| P1 | 工作站表单缺 role 字段 | 补 role 输入（后端已有 role 列） |
| P2 | X2 版本字段 | 见 X2 |
| P2 | team 默认 '前端团队' 硬编码 | 默认空 |

## 2.7 团队表单

| 优先级 | 问题 | 修复 |
|--------|------|------|
| P0 | workflow 绑定无入口（团队空跑） | 团队管理加「绑定工作流」入口 |
| P1 | 名称无前端去重（后端 unique） | `team/validate.ts` 加查重 |
| P1 | 创建时不能添加成员 | 创建后引导「添加成员」 |
| P2 | category 自由文本 + 默认值漂移 | 枚举约束 |

## 2.8 工作流编辑器（最重要）

| 优先级 | 问题 | 修复 |
|--------|------|------|
| P0 | 无执行/测试入口 | 加「运行」按钮调团队 pipeline 或节点单测 |
| P0 | 条件/分支无配置 UI（priority/is_default 虚设） | 加分支配置面板或明确不支持 |
| P1 | 节点 id 用 name、随机位置 | 用 agentConfigId 作 id；自动布局 |
| P1 | 节点无输入/输出契约 | 节点面板加 objective/output format |
| P1 | 无独立工作流列表/创建入口 | 对齐 Dify/n8n 工作流管理视图 |
| P2 | 无环路校验 | 保存时检测环 |
| P2 | 无 dirty 检测 | 未保存更改提示 |
| P2 | confirm 原生对话框 | 换 DeleteConfirmModal |

---

# 第三部分：优化推广（把各表单的加分项横向复制）

| 加分项 | 来源表单 | 推广到 |
|--------|---------|--------|
| **表单内联测试按钮** | 工具表单 `ToolFormModal.tsx:82-90` | Skill/MCP/提示词/输出约束 |
| **model 默认值联动修正** | Agent 表单 `AgentFormModal.tsx:43-48` | 提示词表单（'GPT-4o' 硬编码） |
| **保存按钮前置 disabled 校验** | 输出约束 `OutputFormModal.tsx:55` | Skill/MCP/Tool/团队 |
| **五 tab 分组** | Agent 弹窗 `AgentConfigModal.tsx:26-32` | 其他多字段表单 |
| **Escape 关闭** | 提示词/输出约束/团队 | 已多表单有，MCP 补充 |
| **无障碍（role=modal + Tab 循环）** | Agent 弹窗 `AgentConfigModal.tsx:37-68` | 全表单 |
| **active/disabled 用户可控状态** | 工具/团队表单 | 替换 MCP 连接三态 |
| **分类用 select 枚举** | 提示词表单 `PromptFormModal.tsx:48-50` | 工具/团队自由文本分类 |
| **ReactFlow 画布（MiniMap/Controls/Delete）** | 工作流编辑器 | 可作为团队编排升级基础 |

---

# 第四部分：分期路线图

## 第 1 期（P0，止血）— 约 3 天

| 项 | 内容 |
|----|------|
| X1 | output_constraints 语义治理（a/b/c 三步） |
| X3 | 双挂载点保存丢字段修复（Skill/MCP/Tool） |
| W-P0 | 工作流加执行/测试入口 |
| W-P0 | 工作流分支配置 UI 或明确不支持 |

**收益**：消除「提示词出现 JSON 元数据」数据污染 + 三处丢数据 + 工作流不可测。

## 第 2 期（P1）— 约 5 天

| 项 | 内容 |
|----|------|
| X2 | 版本字段统一决策（删或自动生成） |
| X4 | 资源 id 用真实 id |
| Skill | 描述必填、name 格式、tool_names 拆分、API 层统一 |
| MCP | 状态改 enabled、env 结构化、/test 回写 |
| Tool | method/headers 补字段、parameters 校验 |
| Prompt | 补 description、参数化 |
| Team | workflow 绑定入口、名称去重 |
| Workflow | 节点 id/布局、契约面板 |

## 第 3 期（P2 + 优化推广）— 约 3 天

- 版本字段收尾、环路/dirty 检测、confirm 换组件
- 加分项横向复制（测试按钮、联动修正、分组、无障碍、枚举分类）
- 输出约束模块职责最终定型（并入提示词 or 独立表）

---

## 附：修复顺序依据

1. **X1（output_constraints）最先**——数据污染 + 语义混乱影响 Agent 运行正确性，且牵连 2 个表单
2. **X3（双挂载丢字段）第二**——静默丢数据是用户可感知的功能缺陷
3. **W-P0（工作流可测+分支）第三**——最重要的功能但 UI 是半成品
4. **X2/X4 + 各 P1** 并行——独立模块无依赖
5. **优化推广**最后——在正确字段基础上再谈体验

> 每项修复验收标准：**「反向追踪」通过**（字段提交后至少 1 个真实消费点）+ 对应表单测试补全。

---

## 附 2：方案审查修正记录（v2）

对修复方案做系统性 review（逐项核对代码 + 竞品），修正 4 处「乱写/乱删/乱改」：

| # | 问题 | 类型 | 修正 |
|---|------|------|------|
| R1 | **MCP 表单误引用 X1**——MCP 模块无任何 output_constraint 代码，X1 是 Agent/输出约束的问题 | 乱写 | 删除 MCP 表单的「X1 输出约束孤岛相关」行 |
| R2 | **X2 版本删除漏快照副作用**——6 模块都有 `create_version` 快照记录 version，直接删会损坏版本历史 | 乱删 | 改方案 A：前端只读 + 后端自动递增（快照保留且有真实来源） |
| R3 | **Skill name lowercase-hyphen 不分场景**——项目有 SKILL.md 导入（`skills.py:138`）+ 手动新建（数据库实体，鼓励中文名），一刀切会拒中文 | 乱改 | 导入时强制校验、手动新建可选提示转换 |
| R4 | **MCP cwd/timeout/headers 补齐漏后端改造**——当前后端仅测试用硬编码（`mcps.py:169,186`），无字段存储/消费 | 乱改隐患 | 方案注明需同步后端改造 |

**经验教训**：
1. **删除前先查「是否有消费点」双向检查**——删除字段前要确认：无前端收集（表单）+ 无后端消费（快照/搜索/展示）双条件才可删。R2 只查了「表单无收集」，漏了「快照有消费」
2. **跨模块引用要核实代码**——R1 把 X1 误挂到 MCP，未核实 MCP 模块是否真有 output_constraint 代码
3. **竞品约束要看适用场景**——R3 的 agentskills name 约束只对「SKILL.md 文件目录」适用，对「数据库实体表单」不适用；导入/新建是两种场景要区分
4. **UI 补字段前先查后端能力**——R4 的「补齐字段」如果后端无存储/消费，只是新增了个假字段（重蹈 X1 覆辙）
