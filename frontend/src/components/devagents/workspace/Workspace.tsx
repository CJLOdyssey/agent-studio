import React from 'react';
import {
  Maximize2, PanelRightClose, FolderKanban, FileCode
} from 'lucide-react';
import type { WorkspaceTab } from '../../../types/devagents';
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
    <aside className="devagents-workspace" ref={workspaceRef}>
      <header className="devagents-workspace-header">
        <div className="devagents-workspace-tabs">
          {getWorkspaceTabs(getAgentType(selectedAgentId)).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`devagents-workspace-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={14} />
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="devagents-workspace-actions">
          <button className="devagents-icon-btn-sm" title={t('workspace.fullscreen')} onClick={toggleWorkspaceFullscreen}>
            <Maximize2 size={14} />
          </button>
          <button
            onClick={() => setIsWorkspaceOpen(false)}
            className="devagents-icon-btn-sm"
            title={t('workspace.collapse')}
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </header>

      <div className="devagents-workspace-content">
        <div className="devagents-file-explorer">
          <div className="devagents-file-header">
            <FolderKanban size={14} />
            <span>{t('workspace.fileExplorer')}</span>
          </div>
          <div className="devagents-file-tree">
            <div className="devagents-empty-tree">
              <FileCode size={32} />
              <p>{t('workspace.emptyFiles')}</p>
            </div>
          </div>
        </div>

        <div className="devagents-editor-area">
          {activeTab.includes('preview') ? (
            <div className="devagents-ui-preview">
              <div className="devagents-preview-empty">
                <FileCode size={32} />
                <p>{t('workspace.noPreview')}</p>
              </div>
            </div>
          ) : activeTab.includes('test') ? (
            <div className="devagents-test-panel">
              <div className="devagents-test-header">
                <FileCode size={14} />
                <span>{t('workspace.testRunner')}</span>
              </div>
              <div className="devagents-test-results">
                <p className="devagents-empty-text">{t('workspace.noTests')}</p>
              </div>
            </div>
          ) : (
            <div className="devagents-code-editor">
              <div className="devagents-code-header">
                <FileCode size={12}/> <span className="text-[var(--icon-code)]">Agent</span> {t('workspace.committedJustNow')}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="devagents-workspace-status">
        <div className="devagents-status-left">
           <span className="devagents-status-item">{t('workspace.noErrors')}</span>
        </div>
      </div>
    </aside>
  );
}
