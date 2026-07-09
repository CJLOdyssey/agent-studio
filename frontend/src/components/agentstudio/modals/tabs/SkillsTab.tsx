import { Plus, Sparkles } from 'lucide-react';
import SkillFormModal from '../../workstation/skill/SkillFormModal';
import type { SkillFormData } from '../../workstation/skill/skill.types';
import ConfigItemList from '../ConfigItemList';

interface SkillsTabProps {
  items: Array<{ id: string; name: string; description?: string; enabled: boolean }>;
  editingId: string | null;
  showForm: boolean;
  formData: SkillFormData;
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
  setFormData: (fn: (d: SkillFormData) => SkillFormData) => void;
  onEditFull?: (item: Record<string, unknown>) => void;
}

export function SkillsTab({
  items, editingId, showForm, formData, formErrors, editingItem,
  onToggle, onAdd, onUpdate, onRemove, onStartEdit, onFinishEdit,
  onPickerOpen, onCustomize, onFormSave, onFormClose, setFormData, onEditFull,
}: SkillsTabProps) {
  if (showForm) {
    return (
      <SkillFormModal
        editingSkill={editingItem as unknown as import('../../workstation/skill/skill.types').SkillEntry | null}
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
          添加
        </button>
        <span className="agent-config-list-bar-title">Skills ({items.length})</span>
        <button className="agent-config-list-bar-btn" onClick={onCustomize}>
          <Sparkles size={14} />
          自定义
        </button>
      </div>
      <ConfigItemList
        title="Skills"
        items={items}
        presets={[]}
        editingId={editingId}
        emptyLabel="暂无 Skills"
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
