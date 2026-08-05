# 表格列 v5 实现计划（2026-08-02）

依据：`docs/design-review-workspace-tabs-columns-2026-08-02.md`（P1-P3 建议）+ `docs/design-review-workspace-tabs-before-after-2026-08-01.md`（v5 草图）。
分支：pre-migration（用户确认直接做）。每任务独立 commit + 独立 reviewer 评审。

## 全局约束（所有任务必须遵守）

1. **创建时间列**：6 表（agents/prompts/outputs/tools/mcps/skills）新增「创建时间」列，显示 `createdAt`。
   - 数据源核实：后端 `prompts.py:95` / `tools.py:190` / `mcps.py:94` / `skills.py:81` / `agents.py:118` / `teams.py:80` 均返回 `created_at`（ISO 字符串）；仅 skills 额外有 `updated_at`（skills.py:82）。
   - **统一用 createdAt**（7 表一致），列名「创建时间」（对齐 Dify created_at 实测；修订 v5 草图中的「更新时间」——后端无 updated_at 数据源，不扩后端）。
   - 列位置：状态列之后、操作列之前（对齐 v5 草图）。
2. **相对时间格式**（新建 `frontend/src/utils/relativeTime.ts`，导出 `formatRelativeTime(iso: string): string`）：
   - <1 分钟 → 「刚刚」；<60 分钟 → 「N 分钟前」；<24 小时 → 「N 小时前」；昨天 → 「昨天」；<7 天 → 「N 天前」；更早 → `YYYY-MM-DD`（本地时区）。
   - 非法/空值 → 「—」。对齐 n8n TimeAgo 模式。
3. **版本列移除**（agents/tools/mcps/skills 4 表）：thead 与 tbody 的版本单元格删除。**不改表单、不改后端**（表单/后端修复属 form 评审范围，本计划不含）。
4. **名称列截断**（7 表）：名称 `<span>` 套用现有截断模式（tool 描述列已用）：`className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap"` + `title={item.name}`，保留现有 `font-semibold` 等类。
5. **teams 时间格式化**：teams 表「创建时间」列渲染由 `font-mono` 原串直出改为 `formatRelativeTime(item.createdAt)`。
6. 测试：涉及函数（relativeTime）用 TDD 写单测（`frontend/src/utils/__tests__/relativeTime.test.ts`）；组件改动跑现有相关测试 + `tsc --noEmit` + vitest 全量（或相关目录）必须绿，测试输出无噪音。
7. 代码模式：现有自定义 `<table>` + tailwind 类 + `t()` 翻译键（若需新文案，加到对应 `locales.ts` 并保持现有结构）。
8. 每个任务结束必须 git commit（独立提交，信息用现有风格）。

## 任务清单

### Task 1: 相对时间工具 + teams 应用（公共设施）
新建 `frontend/src/utils/relativeTime.ts`（格式见全局约束 2）+ 单测（TDD：先写测试再实现）。
同时应用到 teams：`TeamManagement.tsx:94` 创建时间单元格 `{item.createdAt}` → `{formatRelativeTime(item.createdAt)}`（去掉 font-mono 原串直出）；teams 名称列加截断（全局约束 4）。
验收：单测绿；teams 时间显示相对格式；tsc 通过。

### Task 2: agents 表格列
`AgentManagement.tsx`：
- 新增「创建时间」列（状态后、操作前）：`{formatRelativeTime(item.createdAt)}`；AgentEntry 已有 createdAt（agent.types.ts:14）；表头加 `t('agent.col_created_at')` 或复用 `workstation.createdAt` 键（检查 locales.ts，无则新增）。
- 移除版本列（thead `agent.col.version` + tbody font-mono 单元格）。
- 名称列加截断（全局约束 4）。
- 「运行中」删除菜单项加 disabled 视觉态：makeMenuItems 中 delete 项 `disabled: item.status === 'running'`（守卫已在 useAgentManagement.ts:86 存在，只加 UI 态）。
验收：4 处改动完成；tsc + 相关测试绿。

### Task 3: tools 表格列
`ToolManagement.tsx`：新增「创建时间」列（ToolEntry 有 createdAt tool.types.ts:14）+ 移除版本列（thead tool.col_version + tbody）+ 名称列截断（内置工具行名称含「内置」chip，截断需保留 chip 布局——用 flex/inline 组合避免截断吞掉 chip；参考现有结构）。
验收：同 Task 2。

### Task 4: mcp 表格列
`MCPManagement.tsx`：新增「创建时间」列（MCPEntry 有 createdAt mcp.types.ts:15）+ 移除版本列 + 名称列截断。
验收：同 Task 2。

### Task 5: skills 表格列
`SkillManagement.tsx`：新增「创建时间」列（SkillEntry 有 createdAt skill.types.ts:13）+ 移除版本列 + 名称列截断。注意导入流程创建的条目 createdAt 是 `slice(0,10)` 日期串（SkillManagement.tsx:43），`formatRelativeTime` 需兼容（解析失败 → 「—」；格式约束 2 已覆盖）。
验收：同 Task 2。

### Task 6: prompts + outputs 表格列
`PromptManagement.tsx` + `OutputConstraintManagement.tsx`：各新增「创建时间」列（PromptEntry createdAt prompt.types.ts:12、OutputEntry createdAt output.types.ts:10）+ 名称列截断。两文件均无版本列。
验收：同 Task 2。

### Task 7: 分类 tag 视觉统一
现状三种形态：prompt/output 恒 `wsta-tag-indigo`（PromptManagement.tsx:89 / OutputConstraintManagement.tsx:90）；tool/skill 恒 accent chip（ToolManagement.tsx:99 / SkillManagement.tsx:143）；team 动态多色 `getCategoryTagClass`（team.constants.ts）。
方案：统一为 team 的动态多色方案。将 `getCategoryTagClass` 从 team 模块移至 `workstation/shared/`（如 `categoryTag.ts`），5 个组件统一引用（team 内部改为引用共享函数，删除原导出或 re-export 保持兼容——以实际代码为准，保持最小 diff）。
验收：5 表分类列视觉一致；team 行为不变；tsc 绿。

### Task 8: workflow 列表入口（P3，最大任务）
v4 设计（before-after:597）「☐ 名称(截断) 团队 节点数 状态 创建时间 ⋮」列表 → 点行进 WorkflowEditor。
前置核实（实施者必做，用 codegraph/读码）：
- 后端是否有 workflow 列表端点（现有 `fetchWorkflow(teamId)` 按团队取单配置）；若无，评估最省路径：前端由 teams 列表 + 每团队 fetchWorkflow 汇总？还是后端加列表端点？（倾向后端 `/api/workflows` 列表，返回 team_id/team_name/name/node_count/created_at/status——但**若评估后端改动超过 2 文件，降级为纯前端汇总**并报告）
- 列表页组件 `WorkflowList` + 点行 → 现有 WorkflowEditor（复用 WorkflowManagement 内部结构）。
验收：列表可展示 + 点行进编辑器；无回归。
风险：本任务工作量最大，实施者评估后若需拆分或降级，报告 BLOCKED/DONE_WITH_CONCERNS 由控制者定。

## 任务依赖

Task 2-6 依赖 Task 1（relativeTime 工具）；Task 7 与 1-6 文件不重叠（除 team.constants 与 Task 1 的 teams 无冲突）；Task 8 独立。
串行执行（每任务 commit + review 后进下一个），避免文件冲突。

## 完成标准（全部任务后）

- 7 表列结构与 v5 草图一致（☐ 名称(截断) + 领域列 + 状态 + 创建时间 + ⋮；4 表无版本列）
- `formatRelativeTime` 单测绿
- tsc --noEmit 0 错误；vitest 相关目录全绿
- 浏览器抽查（如有条件）：agents 表显示相对时间、无版本列
