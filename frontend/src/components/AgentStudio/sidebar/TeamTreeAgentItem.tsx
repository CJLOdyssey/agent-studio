import { memo } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, Trash2, Settings, Lock } from 'lucide-react';
import type { Agent } from '../../../types/AgentStudio';
import type { TFunction } from 'i18next';

interface TeamTreeAgentItemProps {
  agent: Agent;
  teamId: string;
  selectedAgentId: string | null;
  isAuthenticated: boolean;
  openLoginModal: () => void;
  editingAgent: string | null;
  editAgentName: string;
  openAgentMenu: string | null;
  menuPosition: { top: number; left: number };
  handleAgentClick: (agent: Agent) => void;
  onEditAgent?: (agent: Agent) => void;
  setOpenAgentMenu: (id: string | null) => void;
  setConfirmDelete: (val: { type: 'agent'; teamId: string; agentId: string } | null) => void;
  toggleAgentMenu: (agentId: string, event: React.MouseEvent) => void;
  startEditAgent: (agent: Agent) => void;
  saveAgentName: () => void;
  handleAgentBlur: () => void;
  onAgentNameChange: (value: string) => void;
  t: TFunction;
}

const TeamTreeAgentItem = memo(function TeamTreeAgentItem({
  agent,
  teamId,
  selectedAgentId,
  isAuthenticated,
  openLoginModal,
  editingAgent,
  editAgentName,
  openAgentMenu,
  menuPosition,
  handleAgentClick,
  onEditAgent,
  setOpenAgentMenu,
  setConfirmDelete,
  toggleAgentMenu,
  startEditAgent,
  saveAgentName,
  handleAgentBlur,
  onAgentNameChange,
  t,
}: TeamTreeAgentItemProps) {
  return (
    <div
      className={`agentstudio-team-agent-item-wrapper group relative px-1 flex items-center${selectedAgentId === agent.id ? ' active' : ''}`}
    >
      {editingAgent === agent.id ? (
        <div className="agentstudio-agent-edit flex-1 min-w-0">
          <input
            className="agentstudio-agent-edit-input w-full py-[3px] px-[6px] border border-[var(--color-accent)] rounded text-sm text-[var(--color-text-primary)] bg-transparent outline-none font-[inherit]"
            value={editAgentName}
            onChange={(e) => onAgentNameChange(e.target.value)}
            onBlur={handleAgentBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveAgentName();
            }}
            autoFocus
          />
        </div>
      ) : (
        <>
          <button
            className="agentstudio-team-agent-item flex items-center gap-[6px] py-[5px] px-2 rounded-md cursor-pointer transition-all duration-150 border-none bg-transparent w-full min-h-[30px] text-[var(--color-text-secondary)] text-sm text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            onClick={() => handleAgentClick(agent)}
          >
            <span className="text-sm font-normal overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0 leading-[1] tracking-[-0.01em]">{agent.name}</span>
          </button>
          <button
            className="agentstudio-agent-menu-btn absolute right-1 top-1/2 -translate-y-1/2 bg-transparent border-none p-[3px] rounded cursor-pointer text-[var(--color-text-muted)] opacity-0 transition-all duration-150 flex items-center justify-center w-[22px] h-[22px] group-hover:opacity-50 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              toggleAgentMenu(agent.id, e);
            }}
          >
            <MoreVertical size={14} />
          </button>

          {openAgentMenu === agent.id && createPortal(
            <div
              className="agentstudio-agent-dropdown agentstudio-portal-dropdown bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-1 min-w-[140px] shadow-[0_4px_16px_rgba(0,0,0,0.15)] z-[9999] z-[99999]"
              style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
            >
              <button
                className="agentstudio-agent-dropdown-item flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-[120ms] border-none bg-transparent w-full text-sm text-[var(--color-text-secondary)] text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                onClick={() => {
                  if (!isAuthenticated) { openLoginModal(); return; }
                  if (onEditAgent) onEditAgent(agent);
                  setOpenAgentMenu(null);
                }}
                title={!isAuthenticated ? '登录后解锁功能' : undefined}
              >
                {isAuthenticated ? <Settings size={14} /> : <Lock size={14} />}
                <span>{t('sidebar.edit')}</span>
              </button>
              <button
                className="agentstudio-agent-dropdown-item flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-[120ms] border-none bg-transparent w-full text-sm text-[var(--color-text-secondary)] text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                onClick={() => {
                  if (!isAuthenticated) { openLoginModal(); return; }
                  startEditAgent(agent);
                }}
                title={!isAuthenticated ? '登录后解锁功能' : undefined}
              >
                {isAuthenticated ? <Pencil size={14} /> : <Lock size={14} />}
                <span>{t('sidebar.rename')}</span>
              </button>
              <button
                className="agentstudio-agent-dropdown-item flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-[120ms] border-none bg-transparent w-full text-sm text-[var(--da-accent-red)] text-left hover:bg-[color-mix(in_srgb,var(--da-accent-red)_10%,transparent)]"
                onClick={() => {
                  if (!isAuthenticated) { openLoginModal(); return; }
                  setConfirmDelete({ type: 'agent', teamId, agentId: agent.id });
                  setOpenAgentMenu(null);
                }}
                title={!isAuthenticated ? '登录后解锁功能' : undefined}
              >
                {isAuthenticated ? <Trash2 size={14} /> : <Lock size={14} />}
                <span>{t('sidebar.delete')}</span>
              </button>
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  );
});

export default TeamTreeAgentItem;
