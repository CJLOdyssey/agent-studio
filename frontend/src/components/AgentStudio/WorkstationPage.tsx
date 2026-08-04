import { useState, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { navGroups, TAB_RENDERERS, type WorkstationTab } from './workstation/tabConfig';

interface Props {
  onClose: () => void;
}

function ModuleFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Module Error</h3>
      <p className="text-sm text-[var(--color-text-muted)]">{(error as Error)?.message || 'Unknown error'}</p>
      <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--color-accent)] text-white border-none cursor-pointer text-sm hover:opacity-90" onClick={resetErrorBoundary}><RefreshCw size={14} /> Retry</button>
    </div>
  );
}

export default function WorkstationPage({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<WorkstationTab>('teams');
  const [prevTab, setPrevTab] = useState<WorkstationTab>('teams');

  const handleTabChange = useCallback((tabId: WorkstationTab) => {
    setPrevTab(activeTab);
    setActiveTab(tabId);
  }, [activeTab]);

  const currentTab = navGroups.flatMap(g => g.tabs).find(t => t.id === activeTab);

  return (
    <div
      className="wsta-root fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]"
      onClick={onClose}
      style={{ animation: 'wstaFadeIn 0.15s ease' }}
    >
      <div
        className="bg-[var(--color-surface-raised)] rounded-xl w-[90vw] max-w-[1200px] h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-1 flex-row min-h-0">
          <nav className="w-[200px] flex-shrink-0 flex flex-col overflow-y-auto bg-[var(--color-surface-raised)] p-5 px-3">
            <div className="text-sm font-semibold text-[var(--color-text-primary)] px-2 mb-1 tracking-tight" style={{ paddingBottom: 28 }}>
              管理工作台
            </div>
            {navGroups.map((group) => (
              <div key={group.label} className="mt-5">
                <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em] px-2 pb-3 leading-5">
                  {group.label}
                </div>
                {group.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-2 mb-0.5 rounded-md border-none cursor-pointer text-sm text-left transition-all duration-100
                      ${activeTab === tab.id
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                        : 'bg-transparent text-[var(--color-text-secondary)] font-normal hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
                      }`}
                  >
                    <tab.icon size={16} className={`flex-shrink-0 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-[var(--color-surface-raised)]">
            <header className="flex items-center justify-between px-6 pt-5 pb-4 bg-[var(--color-surface-raised)] flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {currentTab && (
                  <>
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex-shrink-0">
                      <currentTab.icon size={15} />
                    </span>
                    <div className="flex flex-col">
                      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] m-0 tracking-tight truncate leading-tight">
                        {currentTab.label}
                      </h2>
                      <p className="text-[11px] text-[var(--color-text-tertiary)] m-0 leading-tight mt-px">
                        {currentTab.id === 'teams' && '管理团队和成员'}
                        {currentTab.id === 'workflow' && '配置自动化工作流'}
                        {currentTab.id === 'agents' && '管理 Agent 配置和部署'}
                        {currentTab.id === 'prompts' && '编辑和管理提示词模板'}
                        {currentTab.id === 'outputs' && '配置输出约束和格式'}
                        {currentTab.id === 'tools' && '管理可用工具集成'}
                        {currentTab.id === 'mcp' && '管理 MCP 协议连接'}
                        {currentTab.id === 'skills' && '管理 Skills 能力集'}
                        {currentTab.id === 'monitor' && '系统运行监控和告警'}
                        {currentTab.id === 'logs' && '查看操作审计日志'}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--color-text-tertiary)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                  onClick={onClose}
                  aria-label="关闭"
                >
                  <X size={16} />
                </button>
              </div>
            </header>
            <div className="flex-1 min-h-0 overflow-hidden bg-[var(--color-surface-raised)]" style={{ paddingBottom: 30, animation: activeTab !== prevTab ? 'wstaFadeSlideIn 0.2s ease' : undefined }}>
              <ErrorBoundary key={activeTab} FallbackComponent={ModuleFallback}>
                {TAB_RENDERERS[activeTab]({ onNavigate: (tab) => handleTabChange(tab as WorkstationTab) })}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
