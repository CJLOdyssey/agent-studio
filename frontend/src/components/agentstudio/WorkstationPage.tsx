import { useState } from 'react';
import { Bot, MessageSquare, FileCheck, Wrench, Server, Zap, Users, BarChart3, FileText, GitBranch } from 'lucide-react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import AgentManagement from './workstation/agent/AgentManagement';
import { PromptManagement } from './workstation/prompt';
import OutputConstraintManagement from './workstation/output/OutputConstraintManagement';
import ToolManagement from './workstation/tool/ToolManagement';
import MCPManagement from './workstation/mcp/MCPManagement';
import SkillManagement from './workstation/skill/SkillManagement';
import TeamManagement from './workstation/team/TeamManagement';
import MonitorCenter from './workstation/monitor/MonitorCenter';
import LogAudit from './workstation/logs/LogAudit';
import { WorkflowManagement } from './workstation/workflow';
import { RefreshCw } from 'lucide-react';

function ModuleFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '32px', textAlign: 'center' }} role="alert">
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--da-text-primary)' }}>Module Error</h3>
      <p style={{ fontSize: '13px', color: 'var(--da-text-muted)' }}>{(error as Error)?.message || 'Unknown error'}</p>
      <button style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', background: 'var(--da-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }} onClick={resetErrorBoundary}><RefreshCw size={14} /> Retry</button>
    </div>
  );
}

type WorkstationTab = 'agents' | 'prompts' | 'outputs' | 'tools' | 'mcp' | 'skills' | 'teams' | 'workflow' | 'monitor' | 'logs';

interface NavTab {
  id: WorkstationTab;
  label: string;
  icon: typeof Bot;
}

const navGroups: { label: string; tabs: NavTab[] }[] = [
  {
    label: '核心资源',
    tabs: [
      { id: 'teams', label: '团队管理', icon: Users },
      { id: 'workflow', label: '工作流', icon: GitBranch },
      { id: 'agents', label: 'Agent 管理', icon: Bot },
      { id: 'prompts', label: '提示词管理', icon: MessageSquare },
      { id: 'outputs', label: '输出约束', icon: FileCheck },
    ],
  },
  {
    label: '集成',
    tabs: [
      { id: 'tools', label: '工具管理', icon: Wrench },
      { id: 'mcp', label: 'MCP 管理', icon: Server },
      { id: 'skills', label: 'Skills 管理', icon: Zap },
    ],
  },
  {
    label: '运维',
    tabs: [
      { id: 'monitor', label: '监控中心', icon: BarChart3 },
      { id: 'logs', label: '日志审计', icon: FileText },
    ],
  },
];

export default function WorkstationPage() {
  const [activeTab, setActiveTab] = useState<WorkstationTab>('teams');

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'row', minHeight: 0 }}>
      <nav style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRight: '1px solid var(--da-border-subtle)', background: 'var(--da-bg-surface)', padding: '20px 12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--da-text-primary)', padding: '0 8px 16px', borderBottom: '1px solid var(--da-border)', marginBottom: '4px', letterSpacing: '-0.01em' }}>
          管理工作台
        </div>
        {navGroups.map((group) => (
          <div key={group.label} style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--da-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 6px' }}>
              {group.label}
            </div>
            {group.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 10px', marginBottom: '2px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                  background: activeTab === tab.id ? 'var(--da-bg-hover)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--da-accent)' : 'var(--da-text-secondary)',
                  fontWeight: activeTab === tab.id ? 500 : 400,
                  transition: 'background 0.12s ease, color 0.12s ease',
                }}
                onMouseEnter={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.background = 'var(--da-bg-hover)'; e.currentTarget.style.color = 'var(--da-text-primary)'; }}}
                onMouseLeave={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--da-text-secondary)'; }}}
              >
                <tab.icon size={16} style={{ flexShrink: 0, opacity: activeTab === tab.id ? 1 : 0.6 }} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 24px', borderBottom: '1px solid var(--da-border-subtle)', flexShrink: 0 }}>
          {(() => { const tab = navGroups.flatMap(g => g.tabs).find(t => t.id === activeTab); return tab ? <><tab.icon size={20} style={{ color: 'var(--da-accent)', flexShrink: 0 }} /><h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--da-text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{tab.label}</h2></> : null; })()}
        </header>
        <ErrorBoundary key={activeTab} FallbackComponent={ModuleFallback}>
          {activeTab === 'agents' && <AgentManagement />}
          {activeTab === 'prompts' && <PromptManagement />}
          {activeTab === 'outputs' && <OutputConstraintManagement />}
          {activeTab === 'tools' && <ToolManagement />}
          {activeTab === 'mcp' && <MCPManagement />}
          {activeTab === 'skills' && <SkillManagement />}
          {activeTab === 'teams' && <TeamManagement />}
          {activeTab === 'workflow' && <WorkflowManagement />}
          {activeTab === 'monitor' && <MonitorCenter onNavigate={(tab) => setActiveTab(tab as WorkstationTab)} />}
          {activeTab === 'logs' && <LogAudit />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
