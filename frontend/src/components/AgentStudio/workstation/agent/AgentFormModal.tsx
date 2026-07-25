import { memo, useState, useCallback, useEffect } from 'react';
import { X, Bot } from 'lucide-react';
import type { AgentEntry, AgentFormData } from './agent.types';
import { useModelOptions } from '../constants';
import { listTeams } from '../../../../api/client/teams';
import { ResourcePickerSection } from './ResourcePickerSection';
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

function AgentFormModal({ editingAgent, formData, setFormData, onSave, onClose, availablePrompts, availableTools, availableMCPs, availableSkills }: Props) {
  const modelOptions = useModelOptions();
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);

  useEffect(() => {
    listTeams().then((items) => setTeamOptions(items.map((t) => t.name))).catch(() => {});
  }, []);

  const selectedPrompt = availablePrompts.find((p) => p.id === formData.systemPromptId);
  const selectedTools = availableTools.filter((t) => formData.toolIds.includes(t.id));
  const selectedMCPs = availableMCPs.filter((m) => formData.mcpIds.includes(m.id));
  const selectedSkills = availableSkills.filter((s) => formData.skillIds.includes(s.id));

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="modal-title">
            <Bot size={16} />
            {editingAgent ? t('agent.form_edit_title') : t('agent.form_create_title')}
          </div>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={16} /></button>
        </div>

        {/* ── Body ── */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col">
          {/* ═══ Section: Basic Info ═══ */}
          <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-3">
              <Bot size={14} />
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
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('agent.form_team')}</label>
                <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.team} onChange={(e) => setFormData({ ...formData, team: e.target.value })}>
                  <option value="">—</option>
                  {teamOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('agent.form_model')}</label>
                <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })}>
                  {modelOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1" style={{ maxWidth: 140 }}>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('agent.form_version')}</label>
                <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} placeholder={t('agent.form_version_placeholder')} />
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
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('agent.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={onSave}>
            {editingAgent ? t('agent.form_save_edit') : t('agent.form_save_create')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(AgentFormModal);
