import { Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConfigItemList from '../ConfigItemList';
import MCPFormModal from '../../workstation/mcp/MCPFormModal';
import type { MCPEntry, MCPFormData } from '../../workstation/mcp/mcp.types';

interface MCPTabProps {
  items: Array<{ id: string; name: string; description?: string; enabled: boolean }>;
  editingId: string | null;
  showForm: boolean;
  formData: MCPFormData;
  formErrors: string[];
  editingItem: { id: string; name: string; description?: string } | null;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onUpdate: (id: string, name: string, desc: string) => void;
  onRemove: (id: string) => void;
  onStartEdit: (id: string) => void;
  onFinishEdit: () => void;
  onPickerOpen: () => void;
  onCustomize: () => void;
  onFormSave: () => void;
  onFormClose: () => void;
  setFormData: (fn: (d: MCPFormData) => MCPFormData) => void;
  onEditFull?: (item: Record<string, unknown>) => void;
}

export function MCPTab({
  items, editingId, showForm, formData, formErrors, editingItem,
  onToggle, onAdd, onUpdate, onRemove, onStartEdit, onFinishEdit,
  onPickerOpen, onCustomize, onFormSave, onFormClose, setFormData, onEditFull,
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
    <>
      <div className="agent-config-list-bar">
        <button className="agent-config-list-bar-btn" onClick={onPickerOpen}>
          <Plus size={14} />
          {t('workstation.add')}
        </button>
        <span className="agent-config-list-bar-title">MCP ({items.length})</span>
        <button className="agent-config-list-bar-btn" onClick={onCustomize}>
          <Sparkles size={14} />
          {t('workstation.customize')}
        </button>
      </div>
      <ConfigItemList
        title="MCP"
        items={items}
        presets={[]}
        editingId={editingId}
        emptyLabel={t('workstation.noMcp')}
        hideHeader
        onToggle={onToggle}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onStartEdit={onStartEdit}
        onFinishEdit={onFinishEdit}
        onEditFull={onEditFull}
      />
    </>
  );
}
