# 设计审查：Skill 新建弹窗（SkillFormModal / ItemEditor）深入批判（2026-08-01）

> 承接《design-review-2026-08-01.md》的全局审查，本次聚焦**两个弹窗文件**做逐行深入批判：
> - 管理工作台新建 Skill 弹窗：`frontend/src/components/AgentStudio/workstation/skill/SkillFormModal.tsx`（209 行）
> - 主页编辑 Agent 弹窗 → Skills tab → 新建 Skill：`frontend/src/components/AgentStudio/modals/ItemEditor.tsx`（89 行）
>
> 支撑文件（验证用）：`skill.types.ts`（类型定义）、`tasks/agent_pipeline.py`（后端 tool_names 消费方式）、`useSkillManagement.ts` / `validate.ts` / `api.ts` / `ResourcePickerModal.tsx`（前端数据流消费链）。

---

## 核心事实：ItemEditor 复用 SkillFormModal

`ItemEditor.tsx:77-87` 对 `kind === 'skill'` 直接渲染 workstation 的 `SkillFormModal`。**两个"弹窗"不是两个实现，而是同一个组件的两个挂载点**（管理工作台独立挂载 + Agent 弹窗内经 ItemEditor 转发挂载）。因此 SkillFormModal 的所有缺陷同时影响两条路径，修复一处即治愈两处。

---

## 一、SkillFormModal.tsx 批判

### 功能性缺陷

#### S1. `tool_names` 混装工具名与 MCP 名两类异构资源

- **位置**：`:42-56`（渲染时区分）、`:47-53`（选择时合并写入同一数组）
- **类型证据**：`skill.types.ts:10` `tool_names: string[]` —— 纯字符串数组，无判别式。
- **问题链**：
  1. 工具选择与 MCP 选择都写入同一个 `tool_names`，靠 `tools.some(...)`/`mcps.some(...)` 在**渲染时**反向区分来源。
  2. 若某 MCP 名与某工具名相同，同一字符串同时命中两个集合 → UI 双份选中，保存却是一条记录。
  3. 区分判断依赖"当前从 API 拉取的名字列表"——已选工具/MCP 一旦被删除或改名，名字在两个列表里都消失 → UI 显示"0 个已选"，但 `tool_names` 里**残留脏数据**，用户看到虚假状态。
- **后端割裂证据**：`agent_pipeline.py:261` 把 `tool_names` 拼进 LLM 提示文本；`:272` 用 `tool_names` 匹配 `registered_tools` 表。MCP 名在 registered_tools 中匹配不到 → 混装的 MCP 名只在提示文本生效、在子工具注册循环里被静默跳过。同一字段在前端被当"工具+MCP"，在后端被当"工具"，语义不一致。

#### S2. 三个裸 `fetch` 绕过统一 API 层

- **位置**：`:31-39`（`/api/tools`、`/api/mcps`、`/api/prompts?category=output_constraint`）
- 项目已有 `api/client` axios 实例 + `toolAPI/mcpAPI/skillAPI`，这里直接 `fetch`。
- **后果**：
  - 无 loading 状态——picker 打开瞬间 options 为空数组，用户以为没有数据。
  - 无错误提示——`.catch(() => {})` 静默吞掉，403/网络失败用户毫无感知。
  - 无卸载取消——组件卸载后 setState 触发 React 警告。
  - 与全项目 API 封装割裂，后续鉴权/错误统一处理无法覆盖此处。

#### S3. 工具/MCP 的 `id` 用 `name` 顶替

- **位置**：`:32` `{ id: t.name, name: t.name }`、`:35` 同。
- 把名字当唯一键。重名工具会撞 id，picker 选中/取消行为错乱。后端 `mcp_{name}_` 前缀（`agent_pipeline.py:203`）也依赖名字唯一，前端无防御。

#### S4. constraint picker `selectedIds` 硬编码空数组

- **位置**：`:196` `selectedIds={[]}`
- 多选弹窗不回显已选约束；保存为**整体覆盖**（`:56` `output_constraint: selected.join('\n')`）。用户重新选择时看不到当前已选，容易误删已有约束。

#### S5. Escape 键语义错误

- **位置**：`:61-63` `handleKeyDown` 在 backdrop 上直接 `onClose()`
- 当 picker 子弹窗开着时按 Escape，**先关整个表单而非先关 picker**，与常规弹窗层级语义相悖。

### 扩展性问题

#### S6. 表单字段扩展成本高

- 6 处 `(f) => ({ ...f, 字段: 值 })` 函数式打补丁（`:85/:91/:99-100/:104-105/:113-114/:155-156`）。加字段要同步改 state + 模板 + 校验，无受控表单收敛。

### Minor

- S7. `:75` `flex flex-col flex flex-col gap-4` —— 重复的 `flex flex-col` class。
- S8. `output_constraint` 用 `\n` 拼接多选结果（`:56`），无分隔符转义；且存的是约束**名字而非 id**，约束改名后引用断裂（与 S4 同源）。

---

## 二、ItemEditor.tsx 批判

### 设计加分项

- 复用 workstation 成熟表单组件，Agent 弹窗内**没有另造一套 Skill 表单**——避免了"两套实现漂移"的更坏情况。

### 功能性缺陷

#### I1. `editingItem` 全量退化为 `Record<string, unknown>`

- **位置**：`:12` `editingItem: Record<string, unknown> | null`
- 丢失全部类型信息，`buildSkillItem`（`:34-49`）8 个字段全用 `as string`/`as string[]` 强转，无运行时校验。后端返回缺字段/异常结构时，UI 静默显示空串而非报错。

#### I2. `buildSkillItem` 与 `useConfigItemEdit.itemsToSkillFormData` 是两份平行字段映射

- `ItemEditor.tsx:34-49` vs `modals/tabs/useConfigItemEdit.ts:98-110`，字段（name/description/category/status/version/author/instructions/tool_names/output_constraint）几乎逐字重复。
- **这是"字段增删要同步维护两处"的直接证据**——此处加字段，`useConfigItemEdit` 也要加；漏一处就出现"编辑回显"与"新建表单"行为不一致。
- 修正上一轮全局审查 E2 的表述：不是"两套表单"，而是**一套表单 + 两份字段转换逻辑**。

#### I3. `createdAt: ''` 伪造字段

- **位置**：`:47`、`:30`
- 为满足 `SkillEntry` 类型注入假数据，掩盖了真实 item 字段缺失问题。

### 扩展性

- 新增资源类型（如"触发器"）要改：`kind` 联合类型、`switch` 分支、build 函数——三处同改，结构清晰可接受；真正的瓶颈是 `form.data as unknown` 强转（`:59`），新类型无编译期保障。

---

## 三、前端数据流分析（Skill 创建的完整消费链）

前端消费链：`SkillFormModal` 收集 → `useConfigItemEdit.saveFormItem` → `skillAPI.create` → `createSkill`（api/client）→ 后端 → 回读展示。

### 前端侧缺陷

#### F-A. `clone` 丢失 `tool_names` 和 `output_constraint` —— 复制即丢数据

- **位置**：`api.ts:46-53`
- `clone` 调用 `createSkill` 时**只传 name/description/category/version/status/author/instructions，漏传 `tool_names` 和 `output_constraint`**。
- 克隆出的 Skill 是"残疾副本"——工具绑定与输出约束全丢。
- `useSkillManagement.ts:58` 直接暴露 `copySkill: crud.cloneItem`，管理列表有"复制"入口 → **用户复制 Skill 会静默丢数据，无任何提示**。

#### F-B. `emptyForm` 与 `itemsToSkillFormData` 默认值不一致

- **位置**：`useSkillManagement.ts:32-42`（`emptyForm`：`category: '前端开发'`、`status: 'installed'`）vs `useConfigItemEdit.ts:102`（`itemsToSkillFormData`：`category: 'AI/ML'`、`status: 'available'`）
- **同一个 Skill 新建表单，两条入口默认值不同**——管理工作台新建默认"前端开发/已安装"，Agent 弹窗内新建默认"AI/ML/可用"。
- I2 的直接扩展：不仅字段映射双份，连**默认值也双份且漂移**。

#### F-C. `toEntry` 对 `status` 做静默纠正

- **位置**：`api.ts:11` `status` 不在 `'installed'|'available'` 时回退 `'installed'`
- 但 `SkillFormModal.tsx:105` 的 select 只允许 `SkillEntry['status']` 合法值。**校验链两端对合法值的认知不一致**——后端若返回意外状态会被悄悄改成 installed，用户无法察觉。

#### F-D. `validate.ts` 只校验 name/version/instructions，不校验 `tool_names`

- **位置**：`validate.ts:7-16`
- 名称去重、版本格式、指令非空——**没有任何校验 `tool_names` 里的名字是否真实存在**。
- 前端校验不设防 + 后端 `agent_pipeline.py:272` 匹配不到就静默跳过 = **用户可成功创建运行期永远绑不上工具/MCP 的 Skill，全程无任何报错**。这是 S1 的收尾确认。

#### F-E. constraint picker 永远从空选集开始（`tempSelected` 只读一次）

- **位置**：`ResourcePickerModal.tsx:32-35` `tempSelected` 初始化自 `selectedIds`，**仅在组件挂载时读一次**。
- 结合 `SkillFormModal.tsx:196` `selectedIds={[]}`：constraint 弹窗每次打开都从空选集开始，已选约束不可见——S4 在前端组件的落地机制。

### 前后端合并结论

Skill 创建功能存在**前端主动丢数据**（F-A clone 漏字段）、**前端双默认值漂移**（F-B）、**前后端校验都放行无效 tool_names**（F-D + 后端静默跳过）三层问题叠加。最严重：**用户能成功创建运行期永远绑不上工具/MCP 的 Skill，且全程无任何报错**。

---

## 四、修复优先级

| 优先级 | 编号 | 简述 | 影响面 |
|--------|------|------|--------|
| P0 | S1 | `tool_names` 拆分为 `tool_names` + `mcp_names`（或引入判别式联合类型） | 两弹窗 + 后端 pipeline 消费 |
| P0 | S2 | 裸 fetch 换统一 API client，补 loading/error | 两弹窗 |
| P0 | F-A | clone 补传 `tool_names`/`output_constraint` | 管理列表复制入口 |
| P1 | S3 | 用真实 id 而非 name 作为 picker 唯一键 | 两弹窗 |
| P1 | S4/F-E | constraint picker 回显已选，保存改为增量而非覆盖 | 两弹窗 |
| P1 | S5 | Escape 先关 picker 再关表单 | 两弹窗 |
| P1 | F-D | `validate.ts` 校验 `tool_names` 真实性 | 两弹窗 |
| P2 | S6 | 引入受控表单或表单库收敛字段更新 | 两弹窗 |
| P2 | I1 | `editingItem` 用强类型 + 运行时校验 | Agent 弹窗路径 |
| P2 | I2/F-B | 合并两份字段映射 + 默认值为单一 source of truth | 跨模块 |
| P3 | S7/S8/I3 | class 重复、约束引用 id、伪造 createdAt | 小修 |
