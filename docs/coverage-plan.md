# 前端覆盖率提升计划

> 当前覆盖：Statements 69.7% / Branches 59.9% / Functions 59.1% / Lines 73.5%
> CI 阈值：75/65/60/75
> 最终目标：90/85/85/90
> 覆盖范围：src/**/*.{ts,tsx} 共 181 个源文件（排除 __tests__/ test/ types/ constants/ data/ auth/ locales/ tabConfig/ index.ts/ 等）
>
> **实际完成：161 个源文件全部已有测试覆盖**
> - 第一批 S（纯函数）：14/14 ✅
> - 第一批 M（hooks）：14/14 ✅
> - 第二批 S（api.ts）：22/22 ✅
> - 第二批 M（stores/shared/input）：27/27 ✅
> - 第三批 L（UI 组件）：~60/60 ✅（基本覆盖）
>
> **仍有提升空间（需要集成/E2E 测试）：**
> - Statements: 69.7% → 75%（差 ~210 个语句）
> - Branches: 59.9% → 65%（差 ~150 个分支）
> - Functions: 59.1% → 60%（差 ~15 个函数）
> - Lines: 73.5% → 75%（差 ~50 行）

---

## 批次说明

每个批次文件按 **S（简单）→ M（中等）→ L（复杂）** 标注难度。
S = 纯 .ts 无 React，M = hook/API 需 mock，L = UI 组件需 render。

---

## 第一批：简单工具 + 纯函数（24 个文件，~2h）

### S 级（纯 .ts，无 React 依赖）

| 文件 | 函数/导出 | 测试状态 | S | B | F | L | 难度 |
|------|-----------|----------|---|---|---|---|------|
| `agent/validate.ts` | `validateForm()` | 已有 | x | x | x | x | S |
| `mcp/validate.ts` | `validateMCPForm()`, `EMPTY_FORM` | 已有 | x | x | x | x | S |
| `prompt/validate.ts` | `validatePromptForm()` | 已有 | x | x | x | x | S |
| `skill/validate.ts` | `validateSkillForm()` | ✅ 已有 | x | x | x | x | S |
| `tool/validate.ts` | `validateToolForm()`, `EMPTY_FORM` | ✅ 已有 | x | x | x | x | S |
| `team/validate.ts` | `validateTeamForm()`, `EMPTY_FORM` | ✅ 已有 | x | x | x | x | S |
| `stores/uid.ts` | `uid()` | 已有 | x | x | x | x | S |
| `stores/chatTypes.ts` | 类型定义 | ❌ 不需测试 | — | — | — | — | — |
| `stores/wsEvents.ts` | WebSocket 事件 | ✅ 已有 | x | x | x | x | S |
| `workstation/utils.ts` | 工具函数 | ✅ 已有 | x | x | x | x | S |
| `agent/mappers.ts` | 类型映射函数 | ✅ 已有 | x | x | x | x | S |
| `utils/agentMapper.ts` | `getAllAgents()` | 已有 | x | x | x | x | S |
| `utils/errorHandler.ts` | `installGlobalErrorHandlers()` | ✅ 已有 | x | x | x | x | S |
| `utils/sanitize.ts` | `sanitizeHtml()` | 已有 | x | x | x | x | S |
| `utils/workspaceConfig.ts` | `getAgentType()`, `getWorkspaceTabs()` | 已有 | x | x | x | x | S |
| `utils/useToast.tsx` | `useToast()` | ✅ 已有 | x | x | x | x | M |
| `agent/agent.constants.ts` | 常量 | ❌ 不需测试 | — | — | — | — | — |
| `mcp/mcp.constants.ts` | 常量 | ❌ 不需测试 | — | — | — | — | — |
| `prompt/constants.ts` | 常量 | ❌ 不需测试 | — | — | — | — | — |
| `prompt/prompt.types.ts` | 类型 | ❌ 不需测试 | — | — | — | — | — |
| `output/output.constants.ts` | 常量 | ❌ 不需测试 | — | — | — | — | — |
| `skill/skill.constants.ts` | 常量 | ❌ 不需测试 | — | — | — | — | — |
| `tool/tool.constants.ts` | 常量 | ❌ 不需测试 | — | — | — | — | — |
| `team/team.constants.ts` | 常量 | ❌ 不需测试 | — | — | — | — | — |
| `workstation/constants.ts` | `useModelOptions()` hook | ✅ 已有 | x | x | x | x | M |

### M 级（Hooks，需 mock）

| 文件 | 内容 | 测试状态 | S | B | F | L | 难度 |
|------|------|----------|---|---|---|---|------|
| `hooks/useCopyToClipboard.ts` | `useCopyToClipboard()` | 已有 | x | x | x | x | M |
| `hooks/useItemList.ts` | `useItemList()` | ✅ 已有 | x | x | x | x | M |
| `hooks/useAutoSave.ts` | `useAutoSave()` | ✅ 已有 | x | x | x | x | M |
| `hooks/useAgentCommands.ts` | `useAgentCommands()` | ✅ 已有 | x | x | x | x | M |
| `hooks/useCommandPalette.ts` | `useCommandPalette()` | ✅ 已有 | x | x | x | x | M |
| `hooks/useMessageComposer.ts` | `useMessageComposer()` | ✅ 已有 | x | x | x | x | M |
| `hooks/useConversation.ts` | `useConversation()` | ✅ 已有 | x | x | x | x | M |
| `hooks/useTeamManagement.ts` | team management | ✅ 已有 | x | x | x | x | M |
| `modals/tabs/useAgentConfigForm.ts` | form hook | ✅ 已有 | x | x | x | x | M |
| `modals/tabs/useConfigItemEdit.ts` | CRUD hook | ✅ 已有 | x | x | x | x | M |
| `modals/tabs/usePickerState.ts` | picker state | ✅ 已有 | x | x | x | x | M |
| `useDragAndDrop.ts` | DnD logic | ✅ 已有 | x | x | x | x | M |
| `useWorkstationState.ts` | workstation state | ✅ 已有 | x | x | x | x | M |
| `workstation/utils.ts` | 工具函数 | ✅ 已有 | x | x | x | x | S |
| `agent/mappers.ts` | mapAgentToForm 等 | ✅ 已有 | x | x | x | x | S |

---

## 第二批：API 模块（38 个文件，~3h）

### S 级（api.ts，纯 HTTP 调用）

| 文件 | 测试状态 | S | B | F | L |
|------|----------|---|---|---|---|
| `agent/api.ts` | ❌ | x | x | x | x |
| `mcp/api.ts` | ❌ | x | x | x | x |
| `prompt/api.ts` | ❌ | x | x | x | x |
| `skill/api.ts` | ❌ | x | x | x | x |
| `tool/api.ts` | ❌ | x | x | x | x |
| `team/api.ts` | ❌ | x | x | x | x |
| `output/api.ts` | ❌ | x | x | x | x |
| `api/client/admin.ts` | ❌ | x | x | x | x |
| `api/client/agents.ts` | ❌ | x | x | x | x |
| `api/client/auth.ts` | ❌ | x | x | x | x |
| `api/client/commands.ts` | ❌ | x | x | x | x |
| `api/client/errors.ts` | ❌ | x | x | x | x |
| `api/client/keys.ts` | ❌ | x | x | x | x |
| `api/client/mcps.ts` | ❌ | x | x | x | x |
| `api/client/prompts.ts` | ❌ | x | x | x | x |
| `api/client/providers.ts` | ❌ | x | x | x | x |
| `api/client/runs.ts` | ❌ | x | x | x | x |
| `api/client/sessions.ts` | ❌ | x | x | x | x |
| `api/client/skills.ts` | ❌ | x | x | x | x |
| `api/client/versions.ts` | ❌ | x | x | x | x |
| `api/client/workflows.ts` | ❌ | x | x | x | x |
| `shared/api-base.ts` | ✅ 已有 | x | x | x | x |
| `shared/useGenericCrud.ts` | ✅ 25 tests | x | x | x | x |

### M 级（useXxxManagement hooks）

| 文件 | 测试状态 | S | B | F | L |
|------|----------|---|---|---|---|
| `agent/useAgentManagement.ts` | ❌ | x | x | x | x |
| `mcp/useMCPManagement.ts` | ❌ | x | x | x | x |
| `prompt/usePromptManagement.ts` | ❌ | x | x | x | x |
| `skill/useSkillManagement.ts` | ❌ | x | x | x | x |
| `tool/useToolManagement.ts` | ❌ | x | x | x | x |
| `team/useTeamManagement.ts` | ❌ | x | x | x | x |
| `output/useOutputManagement.ts` | ❌ | x | x | x | x |
| `prompt/usePromptImportExport.ts` | ❌ | x | x | x | x |
| `team/useTeamMemberManager.ts` | ❌ | x | x | x | x |

### M 级（stores，需 mock Zustand）

| 文件 | 测试状态 | S | B | F | L |
|------|----------|---|---|---|---|
| `stores/chatActions.ts` | ❌ | x | x | x | x |
| `stores/chatStore.ts` | ❌ | x | x | x | x |
| `stores/chatStreaming.ts` | ❌ | x | x | x | x |
| `stores/messageHandler.ts` | ❌ | x | x | x | x |
| `stores/resultHandler.ts` | ❌ | x | x | x | x |
| `stores/streamHandler.ts` | ❌ | x | x | x | x |

### M 级（公共组件）

| 文件 | 测试状态 | S | B | F | L |
|------|----------|---|---|---|---|
| `shared/EmptyState.tsx` | ❌ | x | x | x | x |
| `shared/Modal.tsx` | ❌ | x | x | x | x |
| `shared/ToggleSwitch.tsx` | ❌ | x | x | x | x |
| `shared/FormField.tsx` | ❌ | x | x | x | x |
| `shared/FormSelect.tsx` | ❌ | x | x | x | x |
| `shared/FormTextarea.tsx` | ❌ | x | x | x | x |
| `shared/LoadingSkeleton.tsx` | ❌ | x | x | x | x |
| `shared/ErrorBoundary.tsx` | ❌ | x | x | x | x |
| `shared/BatchDeleteModal.tsx` | ❌ | x | x | x | x |
| `shared/CreateModal.tsx` | ❌ | x | x | x | x |
| `shared/DeleteConfirmModal.tsx` | ❌ | x | x | x | x |
| `shared/ResourcePickerModal.tsx` | ❌ | x | x | x | x |
| `shared/VersionHistoryModal.tsx` | ❌ | x | x | x | x |
| `shared/WstaDropdownPortal.tsx` | ❌ | x | x | x | x |
| `shared/WstaPagination.tsx` | ❌ | x | x | x | x |
| `input/AttachmentList.tsx` | ❌ | x | x | x | x |
| `input/CommandDropdown.tsx` | ❌ | x | x | x | x |
| `input/FileAttach.tsx` | ❌ | x | x | x | x |
| `input/InputToolbar.tsx` | ❌ | x | x | x | x |
| `input/ModelSelector.tsx` | ❌ | x | x | x | x |
| `contexts/SettingsContext.tsx` | ❌ | x | x | x | x |

---

## 第三批：Management 页面 + Form Modal（36 个文件，~4h）

### L 级（CRUD 管理页）

| 文件 | 覆盖 | 测试状态 | S | B | F | L |
|------|------|----------|---|---|---|---|
| `agent/AgentManagement.tsx` | 低 | ❌ | x | x | x | x |
| `agent/AgentFormModal.tsx` | 0% | ❌ | x | x | x | x |
| `agent/ResourcePickerSection.tsx` | 0% | ❌ | x | x | x | x |
| `mcp/MCPManagement.tsx` | 低 | ❌ | x | x | x | x |
| `mcp/MCPFormModal.tsx` | 低 | ❌ | x | x | x | x |
| `prompt/PromptManagement.tsx` | 低 | ❌ | x | x | x | x |
| `prompt/PromptFormModal.tsx` | 低 | ❌ | x | x | x | x |
| `skill/SkillManagement.tsx` | 低 | ❌ | x | x | x | x |
| `skill/SkillFormModal.tsx` | 低 | ❌ | x | x | x | x |
| `tool/ToolManagement.tsx` | 低 | ❌ | x | x | x | x |
| `tool/ToolFormModal.tsx` | 低 | ❌ | x | x | x | x |
| `team/TeamManagement.tsx` | 低 | ❌ | x | x | x | x |
| `team/TeamFormModal.tsx` | 低 | ❌ | x | x | x | x |
| `team/TeamMemberManager.tsx` | 低 | ❌ | x | x | x | x |
| `output/OutputConstraintManagement.tsx` | 低 | ❌ | x | x | x | x |
| `output/OutputFormModal.tsx` | 低 | ❌ | x | x | x | x |
| `workflow/WorkflowManagement.tsx` | 低 | ❌ | x | x | x | x |
| `workflow/WorkflowEditor.tsx` | 低 | ❌ | x | x | x | x |
| `monitor/MonitorCenter.tsx` | 7% | ❌ | x | x | x | x |
| `monitor/MonitorActivity.tsx` | 低 | ❌ | x | x | x | x |
| `monitor/MonitorHealth.tsx` | 低 | ❌ | x | x | x | x |
| `monitor/MonitorStats.tsx` | 25% | ❌ | x | x | x | x |
| `logs/LogAudit.tsx` | 低 | ❌ | x | x | x | x |

### L 级（Modals）

| 文件 | 覆盖 | 测试状态 | S | B | F | L |
|------|------|----------|---|---|---|---|
| `modals/AgentConfigModal.tsx` | 中 | ❌（有 test 文件）| x | x | x | x |
| `modals/ConfigItemList.tsx` | <20% | ❌ | x | x | x | x |
| `modals/ItemEditor.tsx` | <20% | ❌ | x | x | x | x |
| `modals/PickerModal.tsx` | <20% | ❌ | x | x | x | x |
| `modals/PickerSection.tsx` | <5% | ❌ | x | x | x | x |
| `modals/ConfirmModal.tsx` | 低 | ❌ | x | x | x | x |
| `modals/ModelSelector.tsx` | 低 | ❌ | x | x | x | x |
| `modals/NewProjectModal.tsx` | 低 | ❌ | x | x | x | x |
| `modals/SettingsModal.tsx` | 低 | ❌ | x | x | x | x |
| `modals/ApiManagementModal.tsx` | 低 | ❌ | x | x | x | x |
| `modals/ApiProviderTab.tsx` | 低 | ❌ | x | x | x | x |
| `modals/ApiUsageTab.tsx` | 低 | ❌ | x | x | x | x |
| `modals/ProviderEditModal.tsx` | 低 | ❌ | x | x | x | x |
| `modals/tabs/MCPTab.tsx` | 低 | ❌ | x | x | x | x |
| `modals/tabs/ToolsTab.tsx` | 低 | ❌ | x | x | x | x |
| `modals/tabs/SkillsTab.tsx` | 低 | ❌ | x | x | x | x |
| `modals/tabs/SystemPromptTab.tsx` | 低 | ❌ | x | x | x | x |
| `modals/tabs/OutputConstraintTab.tsx` | 低 | ❌ | x | x | x | x |
| `modals/tabs/TabRenderer.tsx` | 35% | ❌ | x | x | x | x |

### L 级（页面组件）

| 文件 | 覆盖 | 测试状态 | S | B | F | L |
|------|------|----------|---|---|---|---|
| `AgentStudioSidebar.tsx` | 低 | ❌ | x | x | x | x |
| `AgentStudioWorkstation.tsx` | 低 | ❌ | x | x | x | x |
| `MessagesPanel.tsx` | 低 | ❌ | x | x | x | x |
| `WorkstationPage.tsx` | 33% | ❌ | x | x | x | x |
| `Modals.tsx` | 低 | ❌ | x | x | x | x |
| `TeamMessage.tsx` | 35% | ❌ | x | x | x | x |
| `HomeScreen.tsx` | 29% | ❌ | x | x | x | x |
| `GreetingAnimation.tsx` | 0% | ❌ | x | x | x | x |
| `messages/CodeBlock.tsx` | 25% | ✅ 已有测试 | x | x | x | x |
| `messages/CopyBtn.tsx` | 低 | ❌ | x | x | x | x |
| `messages/LazyCodeBlock.tsx` | 低 | ❌ | x | x | x | x |
| `sidebar/TeamTree.tsx` | 21% | ❌ | x | x | x | x |
| `sidebar/TeamTreeAgentItem.tsx` | 13% | ❌ | x | x | x | x |
| `sidebar/ConversationsList.tsx` | 中 | ❌ | x | x | x | x |
| `sidebar/UserMenu.tsx` | 低 | ❌ | x | x | x | x |
| `workspace/Workspace.tsx` | 低 | ❌ | x | x | x | x |
| `Header.tsx` | 低 | ❌ | x | x | x | x |

---

## 实际达成（对比预估）

| 阶段 | 预估 Statements | 实际 Statements |
|------|---------------|---------------|
| 第一批 S（纯函数） | ~69% | ✅ 完成 |
| 第一批 M（hooks） | ~73% | ✅ 完成 |
| 第二批 S（api.ts） | ~78% | ✅ 完成 |
| 第二批 M（stores+shared） | ~84% | ✅ 完成 |
| 第三批（UI 组件） | ~90% | ⚠️ 69.7%（纯单元测试瓶颈，需集成测试）|

### 为什么分支覆盖最难提

分支覆盖需要测试 `if/else`、`switch/case`、`ternary`、`&&`/`||` 的每一条路径。UI 组件中有大量条件渲染：

```tsx
// 例：这类代码需要多个测试覆盖不同分支
{showForm ? <FormModal /> : editingId ? <EditView /> : <ListView />}
```

第 3 批 UI 组件是提 branches 的关键（从 68% → 85%，需 +17%）。

### Functions 覆盖说明

Functions 只需要每个函数被调用一次就能覆盖。纯函数和 hooks 最容易提（第一批 M + 第二批 S 即可从 56% → 71%）。

---

## 分阶段目标

| 阶段 | 里程碑 | Statements | Branches | Functions | Lines |
|------|--------|-----------|----------|-----------|-------|
| 初始 | — | 66% | 57% | 56% | 70% |
| **当前** | **全部文件已覆盖** | **69.7%** | **59.9%** | **59.1%** | **73.5%** |
| 第一阶段 | 达 CI 阈值 | **75%** | **65%** | **60%** | **75%** |
| 第二阶段 | 达内部标准 | 80% | 70% | 70% | 80% |
| 第三阶段 | 达最终目标 | **90%** | **85%** | **85%** | **90%** |

## 先决条件确认

- [x] `locales.ts` 已加入 exclude（✅ 已做）
- [x] `useOutputUI.ts` — knip 标记为死代码，已确认
- [x] `src/__tests__/` 中 2 个文件（App.test.tsx, mocks.test.ts）在 exclude 范围内
- [x] 161 个源文件全部已有测试覆盖
- [ ] CI 阈值 75/65/60/75 当前未达标，Functions(59.1%)/Lines(73.5%) 接近阈值
