import React, { Suspense } from 'react';
import { Bot, MessageSquare, FileCheck, Wrench, Server, Zap, Users, BarChart3, FileText, GitBranch } from 'lucide-react';
import { TableSkeleton } from './shared/LoadingSkeleton';

const AgentManagement = React.lazy(() => import('./agent/AgentManagement'));
const PromptManagement = React.lazy(() => import('./prompt/PromptManagement'));
const OutputConstraintManagement = React.lazy(() => import('./output/OutputConstraintManagement'));
const ToolManagement = React.lazy(() => import('./tool/ToolManagement'));
const MCPManagement = React.lazy(() => import('./mcp/MCPManagement'));
const SkillManagement = React.lazy(() => import('./skill/SkillManagement'));
const TeamManagement = React.lazy(() => import('./team/TeamManagement'));
const WorkflowManagement = React.lazy(() => import('./workflow/WorkflowManagement'));
const MonitorCenter = React.lazy(() => import('./monitor/MonitorCenter'));
const LogAudit = React.lazy(() => import('./logs/LogAudit'));

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

export const TAB_RENDERERS: Record<WorkstationTab, (props: RendererProps) => React.ReactNode> = {
  agents: () => <Suspense fallback={<TableSkeleton />}><AgentManagement /></Suspense>,
  prompts: () => <Suspense fallback={<TableSkeleton />}><PromptManagement /></Suspense>,
  outputs: () => <Suspense fallback={<TableSkeleton />}><OutputConstraintManagement /></Suspense>,
  tools: () => <Suspense fallback={<TableSkeleton />}><ToolManagement /></Suspense>,
  mcp: () => <Suspense fallback={<TableSkeleton />}><MCPManagement /></Suspense>,
  skills: () => <Suspense fallback={<TableSkeleton />}><SkillManagement /></Suspense>,
  teams: () => <Suspense fallback={<TableSkeleton />}><TeamManagement /></Suspense>,
  workflow: () => <Suspense fallback={<TableSkeleton />}><WorkflowManagement /></Suspense>,
  monitor: ({ onNavigate }) => <Suspense fallback={<TableSkeleton />}><MonitorCenter onNavigate={(tab: string) => onNavigate?.(tab)} /></Suspense>,
  logs: () => <Suspense fallback={<TableSkeleton />}><LogAudit /></Suspense>,
};
