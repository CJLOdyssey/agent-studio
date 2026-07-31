import { memo, useState, useCallback, useEffect } from 'react';
import { X, Cpu } from 'lucide-react';
import type { AgentEntry, AgentFormData } from './agent.types';
import { useModelOptions } from '../constants';
import { listTeams } from '../../../../api/client/teams';
import { ResourcePickerSection } from './ResourcePickerSection';
import { STATUS_LABEL } from './agent.constants';
import { t } from './locales';

/** Minimal reference shape — agent module owns its own reference interface. */
interface RefItem {
  id: string;
  name: string;
}

interface Props {
  editingAgent: AgentEntry | null;
  formData: AgentFormData;
  setFormData: (d: AgentFormData) => void;
  formErrors: string[];
  onSave: () => void;
  onClose: () => void;
  availablePrompts: RefItem[];
  availableTools: RefItem[];
  availableMCPs: RefItem[];
  availableSkills: RefItem[];
}

type PickerType = 'prompt' | 'tools' | 'mcp' | 'skills' | null;

function AgentFormModal({ editingAgent, formData, setFormData, onSave, onClose, formErrors, availablePrompts, availableTools, availableMCPs, availableSkills }: Props) {
  const modelOptions = useModelOptions();
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);

  useEffect(() => {
    listTeams().then((items) => setTeamOptions(items.map((t) => t.name))).catch(() => {});
  }, []);

  const matchByIdOrName = (ids: string[], item: RefItem) =>
    ids.includes(item.id) || ids.includes(item.name);
  const selectedPrompt = availablePrompts.find((p) => p.id === formData.systemPromptId || p.name === formData.systemPromptId);
  const selectedTools = availableTools.filter((t) => matchByIdOrName(formData.toolIds, t));
  const selectedMCPs = availableMCPs.filter((m) => matchByIdOrName(formData.mcpIds, m));
  const selectedSkills = availableSkills.filter((s) => matchByIdOrName(formData.skillIds, s));

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Cpu size={16} />
            <h3>{editingAgent ? t('agent.form_title_edit') : t('agent.form_title_new')}</h3>
          </div>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={16} /></button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 pb-5 overflow-y-auto flex-1 min-h-0 flex flex-col">
          {/* ═══ Section: Basic Info ═══ */}
          <div className="pt-4">
            <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
              {t('agent.form_section_basic')}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('agent.form_name')} <span className="text-[var(--color-danger)]">*</span></label>
              <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('agent.form_name_placeholder')} maxLength={30} />
            </div>
            <div className="flex flex-col gap-1" style={{ marginTop: 14 }}>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('agent.form_desc')}</label>
              <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={t('agent.form_desc_placeholder')} rows={2} maxLength={200} />
            </div>
            <div className="flex gap-4" style={{ marginTop: 14 }}>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('agent.form_team')}</label>
                <select className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.team} onChange={(e) => setFormData({ ...formData, team: e.target.value })}>
                  <option value="">—</option>
                  {teamOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('agent.form_model')}</label>
                <select className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })}>
                  {modelOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1" style={{ maxWidth: 140 }}>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('agent.form_version')}</label>
                <input className="w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} placeholder={t('agent.form_version_placeholder')} />
              </div>
              <div className="flex flex-col gap-1" style={{ maxWidth: 120 }}>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">状态</label>
                <select className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as AgentFormData['status'] })}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          <ResourcePickerSection
            formData={formData}
            setFormData={setFormData}
            activePicker={activePicker}
            setActivePicker={setActivePicker}
            selectedPrompt={selectedPrompt}
            selectedTools={selectedTools}
            selectedMCPs={selectedMCPs}
            selectedSkills={selectedSkills}
            availablePrompts={availablePrompts}
            availableTools={availableTools}
            availableMCPs={availableMCPs}
            availableSkills={availableSkills}
          />
        </div>

        {/* ── Footer ── */}
        {formErrors.length > 0 && (
          <div className="px-6 pb-2">
            {formErrors.map((err, i) => (
              <p key={i} className="text-xs text-[var(--color-danger)] flex items-center gap-1">
                <span>•</span> {err}
              </p>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('agent.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" onClick={onSave}>
            {editingAgent ? t('agent.form_save_edit') : t('agent.form_save_create')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(AgentFormModal);
