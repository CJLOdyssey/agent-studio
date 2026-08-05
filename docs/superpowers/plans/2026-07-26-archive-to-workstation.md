# Archive to Workstation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "自定义" button with "新建xxx", add archive confirm dialog after creation, and add "归档"/"已归档" menu items in ConfigItemList.

**Architecture:** Add `archived` field to item types. Remove silent `toolAPI.create()` call. New `ArchiveConfirmModal` for post-save dialog. New `archiveItem()` function in `useConfigItemEdit` shared between dialog and menu.

**Tech Stack:** React 18, TypeScript, i18next, lucide-react

---

## File Structure

| # | File | Action | Responsibility |
|---|------|--------|---------------|
| 1 | `frontend/src/types/AgentStudio.d.ts` | Modify | +`archived?: boolean` on AgentTool/AgentMCP/AgentSkill |
| 2 | `frontend/src/i18n/locales/zh-CN/workstation.json` | Modify | +8 locale keys (zh) |
| 3 | `frontend/src/i18n/locales/en-US/workstation.json` | Modify | +8 locale keys (en) |
| 4 | `frontend/src/components/AgentStudio/modals/ArchiveConfirmModal.tsx` | Create | Archive confirm dialog |
| 5 | `frontend/src/components/AgentStudio/modals/tabs/useConfigItemEdit.ts` | Modify | Remove toolAPI.create, +archiveItem, +pendingArchive state |
| 6 | `frontend/src/components/AgentStudio/modals/tabs/TabRenderer.tsx` | Modify | Wire pendingArchive + onArchive |
| 7 | `frontend/src/components/AgentStudio/modals/tabs/ToolsTab.tsx` | Modify | Button label: "自定义" → "新建工具" |
| 8 | `frontend/src/components/AgentStudio/modals/tabs/MCPTab.tsx` | Modify | Button label: "自定义" → "新建MCP" |
| 9 | `frontend/src/components/AgentStudio/modals/tabs/SkillsTab.tsx` | Modify | Button label: "自定义" → "新建Skill" |
| 10 | `frontend/src/components/AgentStudio/modals/ConfigItemList.tsx` | Modify | Menu: +归档按钮 / +已归档(disabled) |
| 11 | `frontend/src/hooks/useItemList.ts` | Verify | `update` supports merging fields, no change needed |

---

### Task 1: Add `archived` field to types

**Files:**
- Modify: `frontend/src/types/AgentStudio.d.ts`

- [ ] **Step 1: Add `archived?: boolean` to AgentTool, AgentMCP, AgentSkill**

Read the file first, then add the field.

```typescript
// AgentTool
export interface AgentTool {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  parameters?: string;
  archived?: boolean;  // NEW
}

// AgentMCP
export interface AgentMCP {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  archived?: boolean;  // NEW
}

// AgentSkill
export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  archived?: boolean;  // NEW
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit` (or `npm run typecheck`)
Expected: exit 0 with no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/AgentStudio.d.ts
git commit -m "feat: add archived field to AgentTool/AgentMCP/AgentSkill types"
```

---

### Task 2: Add locale keys

**Files:**
- Modify: `frontend/src/i18n/locales/zh-CN/workstation.json`
- Modify: `frontend/src/i18n/locales/en-US/workstation.json`

- [ ] **Step 1: Add zh-CN keys**

Read `frontend/src/i18n/locales/zh-CN/workstation.json`. Find the `"customize"` line (around line 71). After the `"customize"` entry (or in a logical group after it), add:

```json
    "newTool": "新建工具",
    "newMCP": "新建 MCP",
    "newSkill": "新建 Skill",
    "archive": "归档",
    "archived": "已归档",
    "archiveConfirmTitle": "确认归档",
    "archiveConfirmDesc": "新建{tool}「{name}」已添加到当前 Agent 配置。是否归档到工作台持久保存？",
    "archiveSuccess": "已归档到工作台",
    "archiveBtn": "归档到工作台"
```

- [ ] **Step 2: Add en-US keys**

Read `frontend/src/i18n/locales/en-US/workstation.json`. Add the same keys:

```json
    "newTool": "New Tool",
    "newMCP": "New MCP",
    "newSkill": "New Skill",
    "archive": "Archive",
    "archived": "Archived",
    "archiveConfirmTitle": "Archive to Workstation",
    "archiveConfirmDesc": "New {tool} \"{name}\" added to agent config. Archive to workstation?",
    "archiveSuccess": "Archived to workstation",
    "archiveBtn": "Archive to Workstation"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/i18n/locales/zh-CN/workstation.json frontend/src/i18n/locales/en-US/workstation.json
git commit -m "feat: add archive-related locale keys"
```

---

### Task 3: Create ArchiveConfirmModal

**Files:**
- Create: `frontend/src/components/AgentStudio/modals/ArchiveConfirmModal.tsx`

- [ ] **Step 1: Create the confirm modal component**

```tsx
import { X, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  kindName: string;  // e.g. "工具", "MCP", "Skill"
  name: string;
  onArchive: () => void;
  onCancel: () => void;
}

export default function ArchiveConfirmModal({ kindName, name, onArchive, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onCancel}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-w-[400px] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Archive size={16} />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('workstation.archiveConfirmTitle')}</h3>
          </div>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onCancel} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {t('workstation.archiveConfirmDesc', { tool: kindName, name })}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)]">
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onCancel}>{t('workstation.cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90" onClick={onArchive}>
            <Archive size={14} />
            {t('workstation.archiveBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/ArchiveConfirmModal.tsx
git commit -m "feat: create ArchiveConfirmModal component"
```

---

### Task 4: Update useConfigItemEdit — remove silent DB write, add archive logic

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/tabs/useConfigItemEdit.ts`

- [ ] **Step 1: Remove toolAPI.create silent call from saveFormItem**

In the `case 'tool':` branch of `saveFormItem`, delete the line:
```typescript
toolAPI.create({ name: data.name, description: data.description || '', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.0.0', endpoint: data.endpoint || '', parameters: data.parameters || '' }).catch(() => {});
```

Also remove the `toolAPI` import at the top of the file:
```typescript
import { toolAPI } from '../../workstation/tool/api';
```

- [ ] **Step 2: Add pendingArchive state and archiveItem function**

Add state and archive logic after the existing `editingToolItem` states (around line 51):

```typescript
type ArchiveKind = 'tool' | 'mcp' | 'skill';

const [pendingArchive, setPendingArchive] = useState<{
  kind: ArchiveKind;
  kindName: string;
  name: string;
  customId: string;
  data: ToolFormData | MCPFormData | SkillFormData;
} | null>(null);

function archiveItem(kind: ArchiveKind, customId: string, data: ToolFormData | MCPFormData | SkillFormData) {
  const apis = {
    tool: toolAPI,
    mcp: mcpAPI,
    skill: skillAPI,
  };
  const listHandles: Record<ArchiveKind, ItemListHandle<unknown>> = {
    tool: tools,
    mcp,
    skill,
  };
  const api = apis[kind];
  api.create(data as any).then((entry: any) => {
    listHandles[kind].update(customId, { id: entry.id, archived: true });
    setPendingArchive(null);
  }).catch(() => {
    // Keep item unarchived; error is swallowed (same pattern as before)
    setPendingArchive(null);
  });
}
```

Wait — need to import mcpAPI and skillAPI as well.

Add imports:
```typescript
import { mcpAPI } from '../../workstation/mcp/api';
import { skillAPI } from '../../workstation/skill/api';
```

Also, `ItemListHandle<T>` has `update` which works with `Partial<T>`. Since `AgentTool`/`AgentMCP`/`AgentSkill` now have `archived`, updating `{ id: entry.id, archived: true }` works because these are on the type.

- [ ] **Step 3: Modify saveFormItem to set pendingArchive instead of just closeForm**

In each case of `saveFormItem`, after `addCustom`, instead of immediately calling `form.closeForm(kind)`, set pendingArchive:

```typescript
function saveFormItem(kind: 'tool' | 'mcp' | 'skill') {
  const f = form.forms[kind];
  const fdata = f.data as Record<string, unknown>;
  if (typeof fdata.name !== 'string' || !fdata.name.trim()) {
    form.setFormErrors(kind, [t('workstation.nameRequired')]);
    return;
  }
  const data = f.data as Record<string, string>;
  const customId = `custom-${Date.now()}`;

  switch (kind) {
    case 'tool':
      if (editingToolItem) {
        tools.update(editingToolItem.id, { name: data.name, description: data.description || '', parameters: data.parameters || '' } as Partial<AgentTool>);
        setEditingToolItem(null);
        form.closeForm(kind);
      } else {
        tools.addCustom(() => ({ id: customId, name: data.name, description: data.description || '', enabled: true, parameters: data.parameters || '' }) as AgentTool);
        form.closeForm(kind);
        setPendingArchive({ kind, kindName: '工具', name: data.name, customId, data: f.data as ToolFormData });
      }
      break;
    case 'mcp':
      if (editingMcpItem) {
        mcp.update(editingMcpItem.id, { name: data.name, description: data.description || '' } as Partial<AgentMCP>);
        setEditingMcpItem(null);
        form.closeForm(kind);
      } else {
        mcp.addCustom(() => ({ id: customId, name: data.name, description: data.description || '', enabled: true }) as AgentMCP);
        form.closeForm(kind);
        setPendingArchive({ kind, kindName: 'MCP', name: data.name, customId, data: f.data as MCPFormData });
      }
      break;
    case 'skill':
      if (editingSkillItem) {
        skills.update(editingSkillItem.id, { name: data.name, description: data.description || '' } as Partial<AgentSkill>);
        setEditingSkillItem(null);
        form.closeForm(kind);
      } else {
        skills.addCustom(() => ({ id: customId, name: data.name, description: data.description || '', enabled: true }) as AgentSkill);
        form.closeForm(kind);
        setPendingArchive({ kind, kindName: 'Skill', name: data.name, customId, data: f.data as SkillFormData });
      }
      break;
  }
}
```

- [ ] **Step 4: Add handleArchiveFromMenu for menu-triggered archive**

Add a function that reconstructs formData from an item and archives it:

```typescript
function handleArchiveFromMenu(kind: ArchiveKind, item: Record<string, unknown>) {
  const data = itemsToFormData(item);
  const customId = String(item.id ?? '');
  archiveItem(kind, customId, data);
}
```

- [ ] **Step 5: Expose pendingArchive and archive handlers in return value**

Add to the return object:
```typescript
return {
  // ...existing returns
  pendingArchive,
  setPendingArchive,
  archiveItem,
  handleArchiveFromMenu,
};
```

Also update the `ConfigItemEditReturn` interface to include these new fields.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/tabs/useConfigItemEdit.ts
git commit -m "feat: remove silent DB write, add archive logic to useConfigItemEdit"
```

---

### Task 5: Wire pendingArchive in TabRenderer

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/tabs/TabRenderer.tsx`

- [ ] **Step 1: Pass pendingArchive and archive handlers through**

TabRenderer needs to:
1. Accept `pendingArchive` and related handlers from parent
2. Render `ArchiveConfirmModal` when `pendingArchive` is set
3. Pass `onArchive` to each tab's `ConfigItemList`

Add to `TabRendererProps`:
```typescript
pendingArchive: { kind: string; kindName: string; name: string; customId: string; data: unknown } | null;
onArchiveConfirm: () => void;
onArchiveCancel: () => void;
onArchiveMenu: (kind: string, item: Record<string, unknown>) => void;
```

In the render function, before the `switch`:
```typescript
import ArchiveConfirmModal from '../ArchiveConfirmModal';

// Inside TabRenderer component, at the top of the return...
```

Add ArchiveConfirmModal rendering:
```typescript
// At the end of the TabRenderer component, before the closing brace:
{pendingArchive && (
  <ArchiveConfirmModal
    kindName={pendingArchive.kindName}
    name={pendingArchive.name}
    onArchive={onArchiveConfirm}
    onCancel={onArchiveCancel}
  />
)}
```

In `renderItemTab`, add `onArchive` to the render context:
```typescript
renderTab: (ctx) => <ToolsTab {...ctx} onArchive={(item) => props.onArchiveMenu('tool', item)} />,
```

And update `TabConfig` interface to include `onArchive`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/tabs/TabRenderer.tsx
git commit -m "feat: wire ArchiveConfirmModal and onArchive in TabRenderer"
```

---

### Task 6: Update ToolsTab / MCPTab / SkillsTab button labels

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/tabs/ToolsTab.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/tabs/MCPTab.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/tabs/SkillsTab.tsx`

- [ ] **Step 1: Change button label from `t('workstation.customize')` to the new key**

In each file, change:
```tsx
{t('workstation.customize')}
```
to (respectively):
- ToolsTab: `{t('workstation.newTool')}`
- MCPTab: `{t('workstation.newMCP')}`
- SkillsTab: `{t('workstation.newSkill')}`

Also add `onArchive` prop to each tab's interface and pass it through to `ConfigItemList`.

**ToolsTab.tsx updates:**

Interface add:
```typescript
onArchive?: (item: Record<string, unknown>) => void;
```

Pass to ConfigItemList:
```typescript
<ConfigItemList
  // ...existing props
  onArchive={onArchive}
/>
```

Same pattern for MCPTab.tsx and SkillsTab.tsx.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/tabs/ToolsTab.tsx frontend/src/components/AgentStudio/modals/tabs/MCPTab.tsx frontend/src/components/AgentStudio/modals/tabs/SkillsTab.tsx
git commit -m "feat: update button labels to 新建xxx, add onArchive prop"
```

---

### Task 7: Update ConfigItemList — add archive/archived menu items

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/ConfigItemList.tsx`

- [ ] **Step 1: Add Archive icon import**

```typescript
import { Plus, MoreVertical, Pencil, Trash2, Archive } from 'lucide-react';
```

- [ ] **Step 2: Add onArchive to Props and ItemMenu**

```typescript
interface Props<T extends ListItem> {
  // ...existing props
  onArchive?: (item: T) => void;
}
```

Update `ItemMenu` to accept `archived` and `onArchive`:

```typescript
function ItemMenu({ onEdit, onArchive, archived, onDelete }: {
  onEdit?: () => void;
  onArchive?: () => void;
  archived: boolean;
  onDelete: () => void;
}) {
  // ...existing code, plus in the menu content:
  {onArchive && archived ? (
    <span className="flex items-center gap-2 py-2 px-2.5 rounded-md w-full text-sm text-[var(--color-text-muted)] text-left cursor-default">
      <span>{t('workstation.archived')}</span>
    </span>
  ) : onArchive ? (
    <button className="flex items-center gap-2 py-2 px-2.5 rounded-md cursor-pointer transition-colors duration-150 border-none bg-transparent w-full text-sm text-[var(--color-text-secondary)] text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={() => { onArchive(); setOpen(false); }}>
      <Archive size={14} /><span>{t('workstation.archive')}</span>
    </button>
  ) : null}
}
```

- [ ] **Step 3: Call ItemMenu with archived info**

In the item rendering loop:
```typescript
<ItemMenu
  onEdit={onEditFull ? () => onEditFull(item) : undefined}
  onArchive={onArchive ? () => onArchive(item) : undefined}
  archived={!!(item as any).archived}
  onDelete={() => onRemove(item.id)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/ConfigItemList.tsx
git commit -m "feat: add archive/archived buttons to ConfigItemList menu"
```

---

### Task 8: Wire everything in AgentConfigModal

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/AgentConfigModal.tsx`

- [ ] **Step 1: Pass pendingArchive and archive handlers to TabRenderer**

Read `AgentConfigModal.tsx` to see how it passes props to TabRenderer. Add:

```typescript
// In AgentConfigModal:
// Pull pendingArchive and handlers from useConfigItemEdit return value
const {
  // ...existing destructuring
  pendingArchive,
  setPendingArchive,
  archiveItem,
  handleArchiveFromMenu,
} = useConfigItemEdit(/* ... */);
```

Wire into TabRenderer:
```tsx
<TabRenderer
  // ...existing props
  pendingArchive={pendingArchive}
  onArchiveConfirm={() => {
    if (pendingArchive) {
      archiveItem(pendingArchive.kind, pendingArchive.customId, pendingArchive.data);
    }
  }}
  onArchiveCancel={() => setPendingArchive(null)}
  onArchiveMenu={handleArchiveFromMenu}
/>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/AgentConfigModal.tsx
git commit -m "feat: wire archive flow in AgentConfigModal"
```

---

### Task 9: Update tests

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/__tests__/hooks/useConfigItemEdit.test.ts`
- Modify: `frontend/src/components/AgentStudio/modals/__tests__/tabs/ToolsTab.test.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/__tests__/tabs/MCPTab.test.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/__tests__/tabs/SkillsTab.test.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/__tests__/TabRenderer.test.tsx`

- [ ] **Step 1: Update useConfigItemEdit test**

Read the test file. Update:
- The test for tool creation should no longer assert that `toolAPI.create` was called (since it was removed)
- Add a test that `saveFormItem` sets `pendingArchive` state

- [ ] **Step 2: Update ToolsTab/MCPTab/SkillsTab tests**

Read each test file. Change test assertions:
- `screen.getByText('自定义')` → `screen.getByText('新建工具')` / `新建 MCP` / `新建 Skill`
- Keep existing flow tests intact

- [ ] **Step 3: Update TabRenderer test**

Read `TabRenderer.test.tsx`. Add:
- Test that `ArchiveConfirmModal` renders when `pendingArchive` is set
- Test that clicking "归档到工作台" triggers `onArchiveConfirm`

- [ ] **Step 4: Verify all tests pass**

Run: `npx vitest run --reporter=verbose` or the project's test command
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/__tests__/
git commit -m "test: update tests for archive workflow"
```

---

### Task 10: Verify build

- [ ] **Step 1: Run build**

Run: `npx vite build` or the project's build command
Expected: exit 0

- [ ] **Step 2: Fix any issues**

If there are type errors or build errors, fix them.

- [ ] **Step 3: Final commit**

```bash
git commit -m "chore: fix build issues"
```
