import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Wrench, Server, Sparkles } from 'lucide-react';
import type { Agent, AgentTool, AgentMCP, AgentSkill } from '@/types/AgentStudio.ts';
import { useItemList } from '@/hooks/useItemList.ts';
import { useAutoSave } from '@/hooks/useAutoSave.ts';
import { useAgentConfigForm } from './tabs/useAgentConfigForm';
import { useConfigItemEdit } from './tabs/useConfigItemEdit';
import { usePickerState } from './tabs/usePickerState';
import TabRenderer from './tabs/TabRenderer';
import PickerSection from './PickerSection';
import type * as React from 'react';

interface Props {
  agent: Agent;
  onSave: (agent: Agent) => void;
  onClose: () => void;
}

const PRESET_TOOLS: Omit<AgentTool, 'enabled'>[] = [];
const PRESET_MCP: Omit<AgentMCP, 'enabled'>[] = [];
const PRESET_SKILLS: Omit<AgentSkill, 'enabled'>[] = [];

export default function AgentConfigModal({ agent, onSave, onClose }: Props) {
  const { t } = useTranslation();

  const TABS = [
    { key: 'system', label: t('workstation.prompt'), icon: null as React.ComponentType<{ size?: number }> | null },
    { key: 'output', label: t('workstation.output'), icon: null },
    { key: 'tools', label: t('workstation.tools'), icon: Wrench },
    { key: 'mcp', label: 'MCP', icon: Server },
    { key: 'skills', label: 'Skills', icon: Sparkles },
  ] as const;
  const modalRef = useRef<HTMLDivElement>(null);
  const systemRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (modal) {
      const firstInput = modal.querySelector<HTMLElement>(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      firstInput?.focus();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus();
    };
  }, [onClose]);

  const tools = useItemList<AgentTool>(PRESET_TOOLS.map((t) => ({ ...t, enabled: false })));
  const mcp = useItemList<AgentMCP>(PRESET_MCP.map((t) => ({ ...t, enabled: false })));
  const skills = useItemList<AgentSkill>(PRESET_SKILLS.map((t) => ({ ...t, enabled: false })));
  const form = useAgentConfigForm();

  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');
  const [outputConstraints, setOutputConstraints] = useState(agent.outputConstraints || '');
  useAutoSave('agentstudio:agent:systemPrompt', systemPrompt);
  useAutoSave('agentstudio:agent:outputConstraints', outputConstraints);
  const [activeTab, setActiveTab] = useState('system');
  const itemEdit = useConfigItemEdit(tools, mcp, skills, form);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) {
      if (agent.tools) tools.setItems(agent.tools.map((t) => ({ ...t, archived: t.archived ?? !t.id.startsWith('custom-') })));
      if (agent.mcp) mcp.setItems(agent.mcp.map((m) => ({ ...m, archived: m.archived ?? !m.id.startsWith('custom-') })));
      if (agent.skills) skills.setItems(agent.skills.map((s) => ({ ...s, archived: s.archived ?? !s.id.startsWith('custom-') })));
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { pickerTab, pickerItems, handlePickerSelect, setPickerTab } = usePickerState({
    setSystemPrompt,
    setOutputConstraints,
    addTool: (item) => tools.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true, archived: !item.is_builtin } as AgentTool)),
    addMcp: (item) => mcp.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true, archived: true }) as AgentMCP),
    addSkill: (item) => skills.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true, archived: true }) as AgentSkill),
  });

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...agent,
      name: name.trim(),
      role: role.trim(),
      systemPrompt,
      outputConstraints,
      tools: tools.items,
      mcp: mcp.items,
      skills: skills.items,
      isConfigured: true,
    });
  };

  const renderTabContent = () => (
    <TabRenderer
      activeTab={activeTab}
      systemRef={systemRef}
      outputRef={outputRef}
      systemPrompt={systemPrompt}
      onSystemPromptChange={setSystemPrompt}
      outputConstraints={outputConstraints}
      onOutputConstraintsChange={setOutputConstraints}
      tools={tools}
      mcp={mcp}
      skills={skills}
      form={form}
      editingToolItem={itemEdit.editingToolItem}
      editingMcpItem={itemEdit.editingMcpItem}
      editingSkillItem={itemEdit.editingSkillItem}
      onSaveFormItem={itemEdit.saveFormItem}
      onFormClose={itemEdit.handleFormClose}
      onSetEditingMcpItem={itemEdit.setEditingMcpItem}
      onSetEditingSkillItem={itemEdit.setEditingSkillItem}
      onEditTool={itemEdit.handleEditTool}
      onEditMcp={itemEdit.handleEditMcp}
      onEditSkill={itemEdit.handleEditSkill}
      onPickerOpen={setPickerTab}
      itemsToFormData={itemEdit.itemsToFormData}
      pendingArchive={itemEdit.pendingArchive}
      onArchiveConfirm={() => {
        if (itemEdit.pendingArchive) {
          itemEdit.archiveItem(itemEdit.pendingArchive.kind, itemEdit.pendingArchive.customId, itemEdit.pendingArchive.data);
        }
      }}
      onArchiveCancel={() => itemEdit.setPendingArchive(null)}
      onArchiveMenu={(kind, item) => itemEdit.handleArchiveFromMenu(kind as 'tool' | 'mcp' | 'skill', item)}
    />
  );

  return (
    <div className="fixed inset-0 bg-(--color-overlay) flex items-center justify-center z-(--z-modal-backdrop) backdrop-blur-xs" onClick={onClose}>
      <div
        className="bg-surface-raised rounded-[16px] w-[min(80vw,760px)] h-[min(85vh,720px)] overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pt-5 px-6 border-b-0">
          <h3 className="text-lg font-semibold text-text-primary m-0">配置Agent</h3>
          <button className="bg-transparent border-none text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-surface-hover hover:text-text-primary active:scale-[0.92]" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="px-6">
          <div className="mt-0">
            <label className="block text-sm font-medium text-text-secondary mb-2">{t('workstation.agentName')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="新 Agent" className="w-full px-3 py-2 bg-surface-raised border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm transition-colors duration-150 focus:outline-none" />
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-text-secondary mb-2">{t('workstation.agentDesc')}</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="如：前端开发工程师、后端 API 设计师..." className="w-full px-3 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm transition-colors duration-150 focus:border-[var(--color-accent)] focus:outline-none" />
          </div>
        </div>

        <div className="flex items-center gap-1 mx-6 mt-3 p-1 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-[10px]">
          {TABS.map((tab) => {
            const count = tab.key === 'tools' ? tools.items.length
              : tab.key === 'mcp' ? mcp.items.length
              : tab.key === 'skills' ? skills.items.length
              : null;
            return (
              <button
                key={tab.key}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border-none rounded-lg bg-transparent text-[var(--color-text-muted)] text-sm font-[450] cursor-pointer transition-[background,color,transform] duration-200 whitespace-nowrap select-none hover:text-[var(--color-text-secondary)] hover:bg-[color-mix(in_srgb,var(--color-text-primary)_4%,transparent)] active:scale-[0.97] [&_svg]:opacity-60 ${activeTab === tab.key ? '!bg-[var(--color-surface-elevated)] !text-[var(--color-text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.06)] !font-medium [&_svg]:!opacity-100 [&_svg]:!text-[var(--color-accent)]' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon && <tab.icon size={16} />}
                {tab.label}
                {count !== null && <span className="text-xs opacity-60 ml-0.5">({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto py-5 px-6 animate-[agentTabFadeIn_0.2s_ease]" key={activeTab}>
          {renderTabContent()}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3.5">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]" onClick={onClose}>{t('workstation.cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={handleSave} disabled={!name.trim()}>{t('workstation.saveConfig')}</button>
        </div>
      </div>

      <PickerSection tab={pickerTab} items={pickerItems} onSelect={handlePickerSelect} onClose={() => setPickerTab(null)} />
    </div>
  );
}
