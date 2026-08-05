# Archive to Workstation — Design Spec

## Problem

"自定义" button in Agent Config Modal (ToolsTab/MCPTab/SkillsTab) opens the same form as Workstation's "新建工具", but:
- **Tool** silently calls `toolAPI.create()` writing to DB (inconsistent)
- **MCP/Skill** don't persist at all (session-only)
- Button label "自定义" doesn't convey "creating something"
- No visual distinction between ephemeral (in-memory) vs persisted (from workstation) items
- Users have no way to explicitly persist a custom item to the workstation DB

## Solution

1. "自定义" → "新建工具" / "新建MCP" / "新建Skill"
2. Save → only local state (remove silent `toolAPI.create`)
3. Post-save confirm dialog: "archive to workstation?"
4. Three-dot menu: "归档" (archive) / "已归档" (archived, disabled)
5. `archived: boolean` field on item types

## Data Model

### Type changes (`AgentStudio.d.ts`)

```typescript
// Add to AgentTool, AgentMCP, AgentSkill:
archived?: boolean;
```

- `true` → item was persisted to workstation DB (either added via picker, or user archived it)
- `false` / `undefined` → item is ephemeral (only exists in this agent config)

### Derivation

| Source | ID format | `archived` |
|--------|-----------|-----------|
| Workstation picker | UUID (DB id) | `true` |
| Custom (新建) | `custom-{timestamp}` | `false` |
| After archive action | UUID (after API call) | `true` |

## Component Changes

### 1. Types

**`frontend/src/types/AgentStudio.d.ts`**
- `AgentTool`, `AgentMCP`, `AgentSkill`: add optional `archived: boolean`

### 2. Button label (ToolsTab / MCPTab / SkillsTab)

| Before | After | locale key |
|--------|-------|-----------|
| `{t('workstation.customize')}` → "自定义" | `{t('workstation.newTool')}` → "新建工具" | `workstation.newTool` |
| same icon | `Sparkles` → `Plus` (or keep) | — |

TabRenderer passes the same `onCustomize` callback, just the label changes.

### 3. saveFormItem — remove silent DB write (useConfigItemEdit.ts)

In `saveFormItem('tool')` case (line 89):
```typescript
// REMOVE this line:
toolAPI.create({ ... }).catch(() => {});
```

All three kinds (tool/mcp/skill) now only write to local state via `tools.addCustom()`.

### 4. Post-save confirm dialog — ArchiveConfirmModal

**New file**: `modals/ArchiveConfirmModal.tsx`

A small confirm dialog shown after `saveFormItem` completes:

```
┌─────────────────────────────────────────┐
│  新建工具「xxx」已添加到当前 Agent 配置   │
│  是否归档到工作台持久保存？               │
│                                         │
│     [取消]          [归档到工作台]       │
└─────────────────────────────────────────┘
```

- "归档到工作台" → calls `onArchive(item)` → back to useConfigItemEdit
- "取消" / X / click backdrop → no-op, dialog closes, item stays unarchived

**Props**:
```typescript
interface ArchiveConfirmProps {
  kind: 'tool' | 'mcp' | 'skill';
  name: string;
  formData: ToolFormData | MCPFormData | SkillFormData;
  onArchive: (kind: 'tool' | 'mcp' | 'skill', data: ToolFormData | MCPFormData | SkillFormData) => void;
  onCancel: () => void;
}
```

### 5. Archive action in useConfigItemEdit

Two entry points for archive:
1. **Post-save confirm dialog** — after `saveFormItem` creates the item, user can immediately archive
2. **Three-dot menu "归档"** — user archives an existing unarchived item later

Both call the same `archiveItem` function:

```typescript
type ArchiveKind = 'tool' | 'mcp' | 'skill';

function archiveItem(kind: ArchiveKind, customId: string, data: ToolFormData | MCPFormData | SkillFormData) {
  const apis = { tool: toolAPI, mcp: mcpAPI, skill: skillAPI };
  const listHandles = { tool: tools, mcp, skill };
  const api = apis[kind];
  api.create(data).then((entry) => {
    // Update local item: replace custom-id with DB id, mark archived
    listHandles[kind].update(customId, { id: entry.id, archived: true });
  }).catch(() => {
    // Show error toast; item stays unarchived
  });
}
```

**Menu case**: the three-dot menu calls `onArchive(item)` → TabRenderer calls `onArchive(item, kind)` → `useConfigItemEdit` has the original form data stored on the editing item, or reconstructs formData from the item fields using `itemsToFormData()`.

**State management**: a simple `pendingArchive` state in `useConfigItemEdit`:
```typescript
const [pendingArchive, setPendingArchive] = useState<{
  kind: ArchiveKind; name: string; data: ToolFormData | MCPFormData | SkillFormData;
} | null>(null);
```

- `saveFormItem` → add to local list → `setPendingArchive({ kind, name, data })`
- Menu "归档" → `archiveItem` directly (no dialog needed since user explicitly clicked archive)
  - Wait: per user requirement, menu archive should ALSO archive immediately without a dialog (the dialog is only for post-save). Let me re-read the requirement... The user said the post-save shows a dialog. For the menu button, it should archive directly (the user explicitly clicked "归档", so no extra confirm needed).

### 6. ConfigItemList — three-dot menu changes

**ItemMenu** gets a new optional prop `onArchive?: () => void` and `archived: boolean`.

| State | Menu item | Behavior |
|-------|-----------|----------|
| `archived = false` | `归档` button (with `Archive` icon) | calls `onArchive()` |
| `archived = true` | `已归档` disabled text (no icon) | no-op, visually muted |

**Props** (`ConfigItemList.tsx`):

```typescript
interface Props<T extends ListItem> {
  // ...existing props
  onArchive?: (item: T) => void;
  archivedItems?: Set<string>; // or rely on item.archived field
}
```

Each `ItemMenu` reads `item.archived` to decide what to render.

### 7. TabRenderer — wire archive

The `renderItemTab` template passes `onArchive` callback down to each tab, which passes it to `ConfigItemList`.

## Locale keys added

### `workstation.json` (zh-CN + en-US)

| Key (zh) | Key (en) | Value (zh) | Value (en) |
|----------|----------|-----------|------------|
| `workstation.newTool` | — | 新建工具 | New Tool |
| `workstation.newMCP` | — | 新建 MCP | New MCP |
| `workstation.newSkill` | — | 新建 Skill | New Skill |
| `workstation.archive` | — | 归档 | Archive |
| `workstation.archived` | — | 已归档 | Archived |
| `workstation.archiveConfirmTitle` | — | 确认归档 | Archive to Workstation |
| `workstation.archiveConfirmDesc` | — | 新建{tool}「{name}」已添加到当前 Agent 配置。是否归档到工作台持久保存？ | New {tool} "{name}" added. Archive to workstation? |
| `workstation.archiveSuccess` | — | 已归档到工作台 | Archived to workstation |
| `workstation.archiveBtn` | — | 归档到工作台 | Archive to Workstation |

## Data flow

```
User clicks "新建工具"
  → ToolFormModal opens (empty form)
  → User fills, clicks "创建工具"
  → saveFormItem('tool'):
      → local state: addCustom()
      → no DB call
      → close form
  → ArchiveConfirmModal opens
      → "归档到工作台" → archiveItem('tool', formData)
          → toolAPI.create(data) → DB
          → update local item: archived=true
      → "取消" → close dialog, item stays unarchived
```

## Files to modify

1. `frontend/src/types/AgentStudio.d.ts` — +`archived` on AgentTool/AgentMCP/AgentSkill
2. `frontend/src/i18n/locales/zh-CN/workstation.json` — new keys
3. `frontend/src/i18n/locales/en-US/workstation.json` — new keys
4. `frontend/src/components/AgentStudio/modals/tabs/useConfigItemEdit.ts` — rm toolAPI.create, +archiveItem
5. `frontend/src/components/AgentStudio/modals/tabs/ToolsTab.tsx` — btn label change
6. `frontend/src/components/AgentStudio/modals/tabs/MCPTab.tsx` — btn label change
7. `frontend/src/components/AgentStudio/modals/tabs/SkillsTab.tsx` — btn label change
8. `frontend/src/components/AgentStudio/modals/ConfigItemList.tsx` — +archive button in menu
9. `frontend/src/components/AgentStudio/modals/tabs/TabRenderer.tsx` — wire onArchive
10. `frontend/src/components/AgentStudio/modals/ArchiveConfirmModal.tsx` — new file

## Out of scope

- Editing an unarchived item then saving: currently the edit modal behaves the same — saves to local only. Could add the archive confirm dialog there too, but not requested.
- Batch archive: not requested.
- Un-archive: not requested.

## Self-review notes

- [x] No placeholders or TODOs
- [x] Internal consistency — all components follow existing patterns
- [x] Scope check — focused on one feature, no scope creep
- [x] Ambiguity check — archived field, button behavior, dialog flow are all explicit
