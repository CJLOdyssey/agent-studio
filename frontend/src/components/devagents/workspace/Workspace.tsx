import React from 'react';
import {
  Play, Maximize2, PanelRightClose, FolderKanban,
  RefreshCw, TestTube2, CheckCircle2, Bug, GitBranch
} from 'lucide-react';
import type { WorkspaceTab } from '../../../types/devagents';
import { mockFiles } from '../../../data/mockFiles';
import { getAgentType, getWorkspaceTabs } from '../../../utils/workspaceConfig';
import FileNodeComponent from './FileNodeComponent';
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
            <FileNodeComponent node={mockFiles[activeTab] || mockFiles['code']} depth={0} />
          </div>
        </div>

        <div className="devagents-editor-area">
          {activeTab.includes('preview') ? (
            <div className="devagents-ui-preview">
              <div className="devagents-preview-status">
                 <RefreshCw size={10}/> {t('workspace.hotReloadReady')}
              </div>
              <div className="devagents-preview-card">
                <h2>Welcome Back</h2>
                <div className="devagents-preview-form">
                  <input type="email" placeholder="Email address" disabled />
                  <input type="password" placeholder="Password" disabled />
                  <button disabled>Sign In</button>
                </div>
              </div>
            </div>
          ) : activeTab.includes('test') ? (
            <div className="devagents-test-panel">
              <div className="devagents-test-header">
                <TestTube2 size={14} />
                <span>{t('workspace.testRunner')}</span>
                <button className="btn btn-sm btn-primary">
                  <Play size={12} />
                  {t('workspace.runTests')}
                </button>
              </div>
              <div className="devagents-test-results">
                <div className="devagents-test-item passed">
                  <CheckCircle2 size={14} />
                  <span>AuthForm.test.tsx</span>
                  <span className="devagents-test-time">12ms</span>
                </div>
                <div className="devagents-test-item passed">
                  <CheckCircle2 size={14} />
                  <span>auth.integration.test.ts</span>
                  <span className="devagents-test-time">156ms</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="devagents-code-editor">
              <div className="devagents-code-header">
                 <GitBranch size={12}/> <span className="text-[var(--icon-code)]">Agent</span> {t('workspace.committedJustNow')}
              </div>
              <pre className="devagents-code-block">
{`import React from 'react';

export default function AuthForm() {
  const handleSubmit = (e) => {
    e.preventDefault();
    // Login triggered - for debugging only
    // console.log('Login triggered');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-96">
        <h2 className="text-2xl font-bold text-white mb-6">Welcome Back</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-gray-900..." />
          <input type="password" placeholder="Password" className="w-full bg-gray-900..." />
          <button className="w-full bg-indigo-600 text-white p-2 rounded">Sign In</button>
        </form>
      </div>
    </div>
  );
}`}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="devagents-workspace-status">
        <div className="devagents-status-left">
           <span className="devagents-status-item"><CheckCircle2 size={12} className="text-[var(--icon-status-success)]"/> {t('workspace.noErrors')}</span>
           <span className="devagents-status-item"><Bug size={12} className="text-[var(--icon-status-warning)]"/> {t('workspace.warnings')}</span>
        </div>
        <div className="devagents-status-right">
           <span>Ln 14, Col 5</span>
           <span>UTF-8</span>
           <span>TypeScript</span>
        </div>
      </div>
    </aside>
  );
}
