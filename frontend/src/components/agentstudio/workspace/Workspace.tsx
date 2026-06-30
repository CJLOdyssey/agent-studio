import React from 'react';
import { Maximize2, PanelRightClose, FolderKanban, FileCode } from 'lucide-react';
import type { WorkspaceTab } from '../../../types/agentstudio';
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
            className="agentstudio-icon-btn-sm"
            title={t('workspace.fullscreen')}
            onClick={toggleWorkspaceFullscreen}
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={() => setIsWorkspaceOpen(false)}
            className="agentstudio-icon-btn-sm"
            title={t('workspace.collapse')}
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </header>

      <div className="agentstudio-workspace-content">
        <div className="agentstudio-file-explorer">
          <div className="agentstudio-file-header">
            <FolderKanban size={14} />
            <span>{t('workspace.fileExplorer')}</span>
          </div>
          <div className="agentstudio-file-tree">
            <div className="agentstudio-empty-tree">
              <FileCode size={32} />
              <p>{t('workspace.emptyFiles')}</p>
            </div>
          </div>
        </div>

        <div className="agentstudio-editor-area">
          {activeTab.includes('preview') ? (
            <div className="agentstudio-ui-preview">
              <div className="agentstudio-preview-empty">
                <FileCode size={32} />
                <p>{t('workspace.noPreview')}</p>
              </div>
            </div>
          ) : activeTab.includes('test') ? (
            <div className="agentstudio-test-panel">
              <div className="agentstudio-test-header">
                <FileCode size={14} />
                <span>{t('workspace.testRunner')}</span>
              </div>
              <div className="agentstudio-test-results">
                <p className="agentstudio-empty-text">{t('workspace.noTests')}</p>
              </div>
            </div>
          ) : (
            <div className="agentstudio-code-editor">
              <div className="agentstudio-code-header">
                <FileCode size={12} /> <span className="text-[var(--icon-code)]">Agent</span>{' '}
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
