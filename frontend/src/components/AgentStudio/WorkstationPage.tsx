import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { navGroups, TAB_RENDERERS, type WorkstationTab } from './workstation/tabConfig';

function ModuleFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Module Error</h3>
      <p className="text-sm text-[var(--color-text-muted)]">{(error as Error)?.message || 'Unknown error'}</p>
      <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--color-accent)] text-white border-none cursor-pointer text-sm hover:opacity-90" onClick={resetErrorBoundary}><RefreshCw size={14} /> Retry</button>
    </div>
  );
}



export default function WorkstationPage() {
  const [activeTab, setActiveTab] = useState<WorkstationTab>('teams');

  return (
    <div className="flex flex-1 flex-row min-h-0">
      <nav className="w-[180px] flex-shrink-0 flex flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5 px-3">
        <div className="text-sm font-semibold text-[var(--color-text-primary)] px-2 pb-4 border-b border-[var(--color-border)] mb-1 tracking-tight">
          管理工作台
        </div>
        {navGroups.map((group) => (
          <div key={group.label} className="mt-5">
            <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em] px-2 pb-1.5">
              {group.label}
            </div>
            {group.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 mb-0.5 rounded-md border-none cursor-pointer text-sm text-left transition-colors duration-100
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
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        <header className="flex items-center gap-2.5 px-6 py-[18px] border-b border-[var(--color-border)] flex-shrink-0">
          {(() => { const tab = navGroups.flatMap(g => g.tabs).find(t => t.id === activeTab); return tab ? <><tab.icon size={20} className="text-[var(--color-accent)] flex-shrink-0" /><h2 className="text-lg font-semibold text-[var(--color-text-primary)] m-0 tracking-tight">{tab.label}</h2></> : null; })()}
        </header>
        <ErrorBoundary key={activeTab} FallbackComponent={ModuleFallback}>
          {TAB_RENDERERS[activeTab]({ onNavigate: (tab) => setActiveTab(tab as WorkstationTab) })}
        </ErrorBoundary>
      </main>
    </div>
  );
}
