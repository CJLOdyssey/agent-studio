import { memo, useCallback, useState, useEffect } from 'react';
import { X, MessageSquareText, Wrench, Server, FileText, ChevronRight, Zap } from 'lucide-react';
import type { SkillEntry, SkillFormData } from './skill.types';
import { SKILL_CATEGORIES, SKILL_STATUS_LABEL } from './skill.constants';
import { useModelOptions } from '../constants';
import { t } from './locales';
import ResourcePickerModal from '../shared/ResourcePickerModal';

interface CompositionOption {
  id: string;
  name: string;
}

type PickerType = 'prompt' | 'tools' | 'mcp' | 'constraint' | null;

interface Props {
  editingSkill: SkillEntry | null;
  formData: SkillFormData;
  setFormData: (fn: (f: SkillFormData) => SkillFormData) => void;
  onSave: () => void;
  onClose: () => void;
  errors: string[];
}

function SkillFormModal({ editingSkill, formData, setFormData, onSave, onClose, errors }: Props) {
  const modelOptions = useModelOptions();
  const [prompts, setPrompts] = useState<CompositionOption[]>([]);
  const [tools, setTools] = useState<CompositionOption[]>([]);
  const [mcps, setMcps] = useState<CompositionOption[]>([]);
  const [constraints, setConstraints] = useState<CompositionOption[]>([]);
  const [activePicker, setActivePicker] = useState<PickerType>(null);

  useEffect(() => {
    fetch('/api/prompts').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPrompts(d.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    }).catch(() => {});
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

  const selectedPrompt = prompts.find(p => p.id === formData.prompt_id);
  const selectedToolNames = formData.tool_names.filter(n => tools.some(t => t.name === n));
  const selectedMCPNames = formData.tool_names.filter(n => mcps.some(m => m.name === n));

  const handlePickerConfirm = (ids: string | string[]) => {
    if (activePicker === 'prompt') {
      setFormData(f => ({ ...f, prompt_id: ids as string }));
    } else if (activePicker === 'tools') {
      const newTools = (ids as string[]);
      const keptMCPs = formData.tool_names.filter(n => mcps.some(m => m.name === n));
      setFormData(f => ({ ...f, tool_names: [...newTools, ...keptMCPs] }));
    } else if (activePicker === 'mcp') {
      const newMCPs = (ids as string[]);
      const keptTools = formData.tool_names.filter(n => tools.some(t => t.name === n));
      setFormData(f => ({ ...f, tool_names: [...keptTools, ...newMCPs] }));
    } else if (activePicker === 'constraint') {
      const selected = constraints.filter(c => (ids as string[]).includes(c.id)).map(c => c.name);
      setFormData(f => ({ ...f, output_constraint: selected.join('\n') }));
    }
    setActivePicker(null);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] max-w-[var(--modal-m)] max-h-[calc(100dvh/1.618)] overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Zap size={16} />
            <h3>{editingSkill ? t('skill.form_title_edit') : t('skill.form_title_new')}</h3>
          </div>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto flex-1 min-h-0 flex flex-col flex flex-col gap-4">
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
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_desc')}</label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('skill.form_desc_placeholder')} rows={2} maxLength={500} />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_category')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.category}
                onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}>
                {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_status')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status}
                onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as SkillEntry['status'] }))}>
                {Object.entries(SKILL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_version')} <span className="text-[var(--color-danger)]">*</span></label>
              <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.version}
                onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))}
                placeholder={t('skill.form_version_placeholder')} />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_model')}</label>
              <select className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.model}
                onChange={(e) => setFormData((f) => ({ ...f, model: e.target.value }))}>
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ═══ Resource Pickers ═══ */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_prompt')} ({selectedPrompt ? 1 : 0})</label>
              <div className="flex items-center justify-between w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm cursor-pointer text-left transition-colors hover:border-[var(--color-accent)]" onClick={() => setActivePicker('prompt')}>
                {selectedPrompt ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquareText size={14} /> {selectedPrompt.name}
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquareText size={14} /> {t('skill.form_select_prompt')}
                  </span>
                )}
                <ChevronRight size={14} />
              </div>
            </div>

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
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('skill.form_instructions')}</label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.instructions}
              onChange={(e) => setFormData((f) => ({ ...f, instructions: e.target.value }))}
              placeholder={t('skill.form_instructions_placeholder')} rows={4} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('skill.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" onClick={onSave}>{editingSkill ? t('skill.form_save_edit') : t('skill.form_save_create')}</button>
        </div>
      </div>

      {activePicker === 'prompt' && (
        <ResourcePickerModal
          title={t('skill.form_select_prompt')}
          options={prompts}
          selectedIds={formData.prompt_id || ''}
          onConfirm={handlePickerConfirm}
          onClose={() => setActivePicker(null)}
          getOptionId={(o: CompositionOption) => o.id}
          getOptionLabel={(o: CompositionOption) => o.name}
          searchPlaceholder={t('skill.form_search')}
        />
      )}
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
    </div>
  );
}

export default memo(SkillFormModal);
