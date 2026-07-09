import { useState } from 'react';
import { Bot, MessageSquare, FileCheck, Wrench, Server, Zap, Users, BarChart3, FileText, Settings, RefreshCw } from 'lucide-react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import AgentManagement from './workstation/agent/AgentManagement';
import { PromptManagement } from './workstation/prompt';
import OutputConstraintManagement from './workstation/output/OutputConstraintManagement';
import ToolManagement from './workstation/tool/ToolManagement';
import MCPManagement from './workstation/mcp/MCPManagement';
import SkillManagement from './workstation/skill/SkillManagement';
import TeamManagement from './workstation/team/TeamManagement';
import MonitorCenter from './workstation/monitor/MonitorCenter';
import LogAudit from './workstation/logs/LogAudit';
import SystemSettings from './workstation/settings/SystemSettings';

function ModuleFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="wsta-module-error" role="alert">
      <h3>模块出错了</h3>
      <p>{(error as Error)?.message || '未知错误'}</p>
      <button className="btn btn-primary" onClick={resetErrorBoundary}>
        <RefreshCw size={14} /> 重试
      </button>
    </div>
  );
}

function logModuleError(error: unknown) {
  console.error('Workstation module error:', error);
}

type WorkstationTab = 'agents' | 'prompts' | 'outputs' | 'tools' | 'mcp' | 'skills' | 'teams' | 'monitor' | 'logs' | 'settings';

export default function WorkstationPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<WorkstationTab>('agents');

  const tabs: { id: WorkstationTab; label: string; icon: typeof Bot }[] = [
    { id: 'teams', label: t('workstation.teamManagement', '团队管理'), icon: Users },
    { id: 'agents', label: t('workstation.agentManagement', 'Agent 管理'), icon: Bot },
    { id: 'prompts', label: t('workstation.promptManagement', '提示词管理'), icon: MessageSquare },
    { id: 'outputs', label: t('workstation.outputManagement', '输出约束'), icon: FileCheck },
    { id: 'tools', label: t('workstation.toolManagement', '工具管理'), icon: Wrench },
    { id: 'mcp', label: t('workstation.mcpManagement', 'MCP 管理'), icon: Server },
    { id: 'skills', label: t('workstation.skillsManagement', 'Skills 管理'), icon: Zap },
    { id: 'monitor', label: t('workstation.monitorCenter', '监控中心'), icon: BarChart3 },
    { id: 'logs', label: t('workstation.logAudit', '日志审计'), icon: FileText },
    { id: 'settings', label: t('workstation.systemSettings', '系统设置'), icon: Settings },
  ];

  return (
    <div className="agentstudio-workstation-page">
      <div className="agentstudio-workstation-body">
        <div className="agentstudio-workstation-sidebar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`agentstudio-workstation-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="agentstudio-workstation-content">
          <ErrorBoundary key={activeTab} FallbackComponent={ModuleFallback} onError={logModuleError}>
            {activeTab === 'agents' && <AgentManagement />}
            {activeTab === 'prompts' && <PromptManagement />}
            {activeTab === 'outputs' && <OutputConstraintManagement />}
            {activeTab === 'tools' && <ToolManagement />}
            {activeTab === 'mcp' && <MCPManagement />}
            {activeTab === 'skills' && <SkillManagement />}
            {activeTab === 'teams' && <TeamManagement />}
            {activeTab === 'monitor' && <MonitorCenter />}
            {activeTab === 'logs' && <LogAudit />}
            {activeTab === 'settings' && <SystemSettings />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
