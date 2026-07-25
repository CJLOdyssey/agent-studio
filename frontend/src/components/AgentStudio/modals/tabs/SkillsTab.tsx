import { Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SkillFormModal from '../../workstation/skill/SkillFormModal';
import type { SkillEntry, SkillFormData } from '../../workstation/skill/skill.types';
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
  const { t } = useTranslation();

  if (showForm) {
    return (
      <SkillFormModal
        editingSkill={editingItem as SkillEntry | null}
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
      <div className="flex items-center justify-between mb-3 gap-2">
        <button className="inline-flex items-center gap-[5px] px-[10px] py-[5px] border border-[var(--da-border)] rounded-md bg-[var(--da-bg-surface)] text-[var(--da-text-muted)] text-xs cursor-pointer transition-[background,border-color,color] duration-150 ease hover:bg-[var(--da-bg-hover)] hover:border-[var(--color-accent)] hover:text-[var(--da-text-primary)] [&>svg]:opacity-60 hover:[&>svg]:opacity-100" onClick={onPickerOpen}>
          <Plus size={14} />
          {t('workstation.add')}
        </button>
        <span className="text-sm font-medium text-[var(--da-text-secondary)]">Skills ({items.length})</span>
        <button className="inline-flex items-center gap-[5px] px-[10px] py-[5px] border border-[var(--da-border)] rounded-md bg-[var(--da-bg-surface)] text-[var(--da-text-muted)] text-xs cursor-pointer transition-[background,border-color,color] duration-150 ease hover:bg-[var(--da-bg-hover)] hover:border-[var(--color-accent)] hover:text-[var(--da-text-primary)] [&>svg]:opacity-60 hover:[&>svg]:opacity-100" onClick={onCustomize}>
          <Sparkles size={14} />
          {t('workstation.customize')}
        </button>
      </div>
      <ConfigItemList
        title="Skills"
        items={items}
        presets={[]}
        editingId={editingId}
        emptyLabel={t('workstation.noSkills')}
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
