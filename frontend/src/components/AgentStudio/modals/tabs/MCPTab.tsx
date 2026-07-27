import { Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConfigItemList from '../ConfigItemList';
import MCPFormModal from '../../workstation/mcp/MCPFormModal';
import type { MCPEntry, MCPFormData } from '../../workstation/mcp/mcp.types';

interface MCPTabProps {
  items: Array<{ id: string; name: string; description?: string; enabled: boolean }>;
  showForm: boolean;
  formData: MCPFormData;
  formErrors: string[];
  editingItem: { id: string; name: string; description?: string } | null;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPickerOpen: () => void;
  onCustomize: () => void;
  onFormSave: () => void;
  onFormClose: () => void;
  setFormData: (fn: (d: MCPFormData) => MCPFormData) => void;
  onEditFull?: (item: Record<string, unknown>) => void;
  onArchive?: (item: Record<string, unknown>) => void;
}

export function MCPTab({
  items, showForm, formData, formErrors, editingItem,
  onToggle, onAdd, onRemove,
  onPickerOpen, onCustomize, onFormSave, onFormClose, setFormData, onEditFull,
  onArchive,
}: MCPTabProps) {
  const { t } = useTranslation();

  if (showForm) {
    return (
      <MCPFormModal
        editingItem={editingItem as MCPEntry | null}
        formData={formData}
        setFormData={setFormData}
        onSave={onFormSave}
        onClose={onFormClose}
        errors={formErrors}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-3 gap-2 shrink-0">
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--color-border)] rounded-md bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] text-xs cursor-pointer transition-[background,border-color,color] duration-150 ease hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] [&>svg]:opacity-60 hover:[&>svg]:opacity-100" onClick={onPickerOpen}>
          <Plus size={14} />
          {t('workstation.add')}
        </button>
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--color-border)] rounded-md bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] text-xs cursor-pointer transition-[background,border-color,color] duration-150 ease hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] [&>svg]:opacity-60 hover:[&>svg]:opacity-100" onClick={onCustomize}>
          <Sparkles size={14} />
          {t('workstation.newMCP')}
        </button>
      </div>
      <ConfigItemList
        title="MCP"
        items={items}
        presets={[]}
        emptyLabel={t('workstation.noMcp')}
        hideHeader
        onToggle={onToggle}
        onAdd={onAdd}
        onRemove={onRemove}
        onEditFull={onEditFull}
        onArchive={onArchive}
      />
    </div>
  );
}
