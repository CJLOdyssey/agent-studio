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
      className={`agentstudio-team-agent-item-wrapper${selectedAgentId === agent.id ? ' active' : ''}`}
    >
      {editingAgent === agent.id ? (
        <div className="agentstudio-agent-edit">
          <input
            className="agentstudio-agent-edit-input"
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
            className="agentstudio-team-agent-item"
            onClick={() => handleAgentClick(agent)}
          >
            <span>{agent.name}</span>
          </button>
          <button
            className="agentstudio-agent-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleAgentMenu(agent.id, e);
            }}
          >
            <MoreVertical size={14} />
          </button>

          {openAgentMenu === agent.id && createPortal(
            <div
              className="agentstudio-agent-dropdown agentstudio-portal-dropdown"
              style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
            >
              <button
                className="agentstudio-agent-dropdown-item"
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
                className="agentstudio-agent-dropdown-item"
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
                className="agentstudio-agent-dropdown-item danger"
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
