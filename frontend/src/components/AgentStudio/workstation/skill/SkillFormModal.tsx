import { memo, useState, useEffect } from 'react';
import { Wrench, Server, FileText, ChevronRight, Zap } from 'lucide-react';
import type { SkillEntry, SkillFormData } from './skill.types';
import { SKILL_STATUS_LABEL } from './skill.constants';
import { t } from './locales';
import ResourcePickerModal from '../shared/ResourcePickerModal';
import Modal from '@/components/shared/Modal';

interface CompositionOption {
  id: string;
  name: string;
}

type PickerType = 'tools' | 'mcp' | 'constraint' | null;

interface Props {
  editingSkill: SkillEntry | null;
  formData: SkillFormData;
  setFormData: (fn: (f: SkillFormData) => SkillFormData) => void;
  onSave: () => void;
  onClose: () => void;
  errors: string[];
}

function SkillFormModal({ editingSkill, formData, setFormData, onSave, onClose, errors }: Props) {
  const [tools, setTools] = useState<CompositionOption[]>([]);
  const [mcps, setMcps] = useState<CompositionOption[]>([]);
  const [constraints, setConstraints] = useState<CompositionOption[]>([]);
  const [activePicker, setActivePicker] = useState<PickerType>(null);

  useEffect(() => {
    fetch('/api/tools').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTools(d.map((t: { id: string; name: string }) => ({ id: t.name, name: t.name })));
    }).catch(() => {});
    fetch('/api/mcps').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setMcps(d.map((m: { id: string; name: string }) => ({ id: m.name, name: m.name })));
    }).catch(() => {});
    fetch('/api/prompts?category=output_constraint').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setConstraints(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    }).catch(() => {});
  }, []);

  const selectedToolNames = formData.tool_names.filter(n => tools.some(t => t.name === n));
  const selectedMCPNames = (formData.mcp_names ?? []).filter(n => mcps.some(m => m.name === n));

  const handlePickerConfirm = (ids: string | string[]) => {
    if (activePicker === 'tools') {
      setFormData(f => ({ ...f, tool_names: ids as string[] }));
    } else if (activePicker === 'mcp') {
      setFormData(f => ({ ...f, mcp_names: ids as string[] }));
    } else if (activePicker === 'constraint') {
      const selected = constraints.filter(c => (ids as string[]).includes(c.id)).map(c => c.name);
      setFormData(f => ({ ...f, output_constraint: selected.join('\n') }));
    }
    setActivePicker(null);
  };

  return (
    <>
      <Modal
        title={
          <div className="flex items-center gap-3">
            <Zap size={16} />
            <h3>{editingSkill ? t('skill.form_title_edit') : t('skill.form_title_new')}</h3>
          </div>
        }
        onClose={onClose}
        hideHeaderBorder
        hideFooterBorder
        width={640}
        bodyClassName="px-5 pb-5 gap-4"
        footer={
          <>
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('skill.form_cancel')}</button>
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" onClick={onSave}>{editingSkill ? t('skill.form_save_edit') : t('skill.form_save_create')}</button>
          </>
        }
      >
        {errors.length > 0 && (
            <div className="p-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-md text-[var(--color-danger)] text-xs">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_name')} <span className="text-[var(--color-danger)]">*</span></label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('skill.form_name_placeholder')} maxLength={50} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_desc')} <span className="text-[var(--color-danger)]">*</span></label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('skill.form_desc_placeholder')} rows={2} maxLength={500} />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_category')}</label>
              <input className="w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.category}
              onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))} placeholder="例如：前端开发、AI/ML" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_status')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status}
                onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as SkillEntry['status'] }))}>
                {Object.entries(SKILL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_version')} <span className="text-[var(--color-danger)]">*</span></label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.version}
              onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))}
              placeholder={t('skill.form_version_placeholder')} />
          </div>

          {/* ═══ Resource Pickers ═══ */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_tools')} ({selectedToolNames.length})</label>
              <div className="flex items-center justify-between w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm cursor-pointer text-left transition-colors hover:border-[var(--color-accent)]" onClick={() => setActivePicker('tools')}>
                {selectedToolNames.length > 0 ? (
                  <span className="text-xs text-[var(--color-text-primary)]">{selectedToolNames.length} 个已选</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Wrench size={14} /> {t('skill.form_select_tools')}</span>
                )}
                <ChevronRight size={14} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_mcp')} ({selectedMCPNames.length})</label>
              <div className="flex items-center justify-between w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm cursor-pointer text-left transition-colors hover:border-[var(--color-accent)]" onClick={() => setActivePicker('mcp')}>
                {selectedMCPNames.length > 0 ? (
                  <span className="text-xs text-[var(--color-text-primary)]">{selectedMCPNames.length} 个已选</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Server size={14} /> {t('skill.form_select_mcp')}</span>
                )}
                <ChevronRight size={14} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_output_constraint')}</label>
              <div className="flex items-center justify-between w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm cursor-pointer text-left transition-colors hover:border-[var(--color-accent)]" onClick={() => setActivePicker('constraint')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> {t('skill.form_select_constraint')}</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_instructions')} <span className="text-[var(--color-danger)]">*</span></label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.instructions}
              onChange={(e) => setFormData((f) => ({ ...f, instructions: e.target.value }))}
              placeholder={t('skill.form_instructions_placeholder')} rows={4} />
          </div>
      </Modal>

      {activePicker === 'tools' && (
        <ResourcePickerModal
          title={t('skill.form_select_tools')}
          options={tools}
          selectedIds={selectedToolNames}
          onConfirm={handlePickerConfirm}
          onClose={() => setActivePicker(null)}
          getOptionId={(o: CompositionOption) => o.id}
          getOptionLabel={(o: CompositionOption) => o.name}
          multiple
          searchPlaceholder="搜索工具..."
        />
      )}
      {activePicker === 'mcp' && (
        <ResourcePickerModal
          title={t('skill.form_select_mcp')}
          options={mcps}
          selectedIds={selectedMCPNames}
          onConfirm={handlePickerConfirm}
          onClose={() => setActivePicker(null)}
          getOptionId={(o: CompositionOption) => o.id}
          getOptionLabel={(o: CompositionOption) => o.name}
          multiple
          searchPlaceholder="搜索MCP..."
        />
      )}
      {activePicker === 'constraint' && (
        <ResourcePickerModal
          title={t('skill.form_select_constraint')}
          options={constraints}
          selectedIds={[]}
          onConfirm={handlePickerConfirm}
          onClose={() => setActivePicker(null)}
          getOptionId={(o: CompositionOption) => o.id}
          getOptionLabel={(o: CompositionOption) => o.name}
          multiple
          searchPlaceholder="搜索约束..."
        />
      )}
    </>
  );
}

export default memo(SkillFormModal);
