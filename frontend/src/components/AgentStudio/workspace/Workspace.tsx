import React from 'react';
import { Maximize2, PanelRightClose, FolderKanban, FileCode } from 'lucide-react';
import type { WorkspaceTab } from '../../../types/AgentStudio';
import { getAgentType, getWorkspaceTabs } from '../../../utils/workspaceConfig';
import { useTranslation } from 'react-i18next';

interface WorkspaceProps {
  selectedAgentId: string | null;
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  isWorkspaceOpen: boolean;
  setIsWorkspaceOpen: (open: boolean) => void;
  toggleWorkspaceFullscreen: () => void;
  workspaceRef: React.Ref<HTMLElement>;
}

export default function Workspace({
  selectedAgentId,
  activeTab,
  setActiveTab,
  isWorkspaceOpen,
  setIsWorkspaceOpen,
  toggleWorkspaceFullscreen,
  workspaceRef,
}: WorkspaceProps) {
  const { t } = useTranslation();
  if (!selectedAgentId || !isWorkspaceOpen) return null;

  return (
    <aside className="agentstudio-workspace" ref={workspaceRef}>
      <header className="agentstudio-workspace-header">
        <div className="agentstudio-workspace-tabs">
          {getWorkspaceTabs(getAgentType(selectedAgentId)).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`agentstudio-workspace-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={14} />
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="agentstudio-workspace-actions">
          <button
            className="agentstudio-icon-btn-sm p-1 rounded bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer transition-colors flex items-center justify-center hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            title={t('workspace.fullscreen')}
            onClick={toggleWorkspaceFullscreen}
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={() => setIsWorkspaceOpen(false)}
            className="agentstudio-icon-btn-sm p-1 rounded bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer transition-colors flex items-center justify-center hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            title={t('workspace.collapse')}
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </header>

      <div className="agentstudio-workspace-content">
        <div className="w-[200px] border-r border-[var(--color-border)] flex flex-col bg-[var(--color-surface-raised)] flex-shrink-0">
          <div className="flex items-center gap-2 p-3 text-xs font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] uppercase tracking-[0.5px]">
            <FolderKanban size={14} />
            <span>{t('workspace.fileExplorer')}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <div className="agentstudio-empty-tree">
              <FileCode size={32} />
              <p>{t('workspace.emptyFiles')}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {activeTab.includes('preview') ? (
            <div className="h-full w-full flex items-center justify-center bg-[var(--color-surface-raised)] relative">
              <div className="agentstudio-preview-empty">
                <FileCode size={32} />
                <p>{t('workspace.noPreview')}</p>
              </div>
            </div>
          ) : activeTab.includes('test') ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border)]">
                <FileCode size={14} />
                <span>{t('workspace.testRunner')}</span>
              </div>
              <div className="flex flex-col gap-2">
                <p className="agentstudio-empty-text">{t('workspace.noTests')}</p>
              </div>
            </div>
          ) : (
            <div className="font-mono text-sm p-4 text-[var(--color-text-primary)] leading-[1.6] overflow-x-auto">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-4">
                <FileCode size={12} /> <span className="text-[var(--color-accent)]">Agent</span>{' '}
                {t('workspace.committedJustNow')}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="agentstudio-workspace-status">
        <div className="agentstudio-status-left">
          <span className="agentstudio-status-item">{t('workspace.noErrors')}</span>
        </div>
      </div>
    </aside>
  );
}
