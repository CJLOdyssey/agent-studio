import { createElement } from 'react';
import { Bot, MessageSquare, FileCheck, Wrench, Server, Zap, Users, BarChart3, FileText, GitBranch } from 'lucide-react';
import AgentManagement from './agent/AgentManagement';
import { PromptManagement } from './prompt';
import OutputConstraintManagement from './output/OutputConstraintManagement';
import ToolManagement from './tool/ToolManagement';
import MCPManagement from './mcp/MCPManagement';
import SkillManagement from './skill/SkillManagement';
import TeamManagement from './team/TeamManagement';
import { WorkflowManagement } from './workflow';
import MonitorCenter from './monitor/MonitorCenter';
import LogAudit from './logs/LogAudit';

export type WorkstationTab = 'agents' | 'prompts' | 'outputs' | 'tools' | 'mcp' | 'skills' | 'teams' | 'workflow' | 'monitor' | 'logs';

export interface NavTab {
  id: WorkstationTab;
  label: string;
  icon: typeof Bot;
}

export interface NavGroup {
  label: string;
  tabs: NavTab[];
}

export const navGroups: NavGroup[] = [
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
      { id: 'logs', label: '审计日志', icon: FileText },
    ],
  },
];

type RendererProps = { onNavigate?: (tab: string) => void };

export const TAB_RENDERERS: Record<WorkstationTab, (props: RendererProps) => ReturnType<typeof createElement>> = {
  agents: () => createElement(AgentManagement),
  prompts: () => createElement(PromptManagement),
  outputs: () => createElement(OutputConstraintManagement),
  tools: () => createElement(ToolManagement),
  mcp: () => createElement(MCPManagement),
  skills: () => createElement(SkillManagement),
  teams: () => createElement(TeamManagement),
  workflow: () => createElement(WorkflowManagement),
  monitor: ({ onNavigate }) => createElement(MonitorCenter, { onNavigate: (tab: string) => onNavigate?.(tab) }),
  logs: () => createElement(LogAudit),
};
