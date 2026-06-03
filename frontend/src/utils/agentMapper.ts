import {
  ClipboardList, Layers, Palette, Code2, Server,
  TestTube, Cloud, Zap, Bot,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentConfig } from '../types';
import type { Agent, Team } from '../types/devagents';
import { INITIAL_TEAMS } from '../constants/initialTeams';

// Map backend role_identifier to frontend icon + styling
const ROLE_STYLE_MAP: Record<string, {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  defaultName: string;
  defaultRole: string;
}> = {
  pm: {
    icon: ClipboardList, color: 'text-[var(--icon-planning)]',
    bg: 'bg-[var(--icon-planning)]/15', border: 'border-[var(--icon-planning)]/25',
    defaultName: '产品经理', defaultRole: '需求分析与产品规划',
  },
  architect: {
    icon: Layers, color: 'text-[var(--icon-planning)]',
    bg: 'bg-[var(--icon-planning)]/15', border: 'border-[var(--icon-planning)]/25',
    defaultName: '架构师', defaultRole: '系统架构与技术选型',
  },
  ui: {
    icon: Palette, color: 'text-[var(--icon-design)]',
    bg: 'bg-[var(--icon-design)]/15', border: 'border-[var(--icon-design)]/25',
    defaultName: 'UI 设计师', defaultRole: '界面与交互设计',
  },
  frontend: {
    icon: Code2, color: 'text-[var(--icon-dev-frontend)]',
    bg: 'bg-[var(--icon-dev-frontend)]/15', border: 'border-[var(--icon-dev-frontend)]/25',
    defaultName: '前端工程师', defaultRole: 'React/Vue 开发',
  },
  backend: {
    icon: Server, color: 'text-[var(--icon-dev-backend)]',
    bg: 'bg-[var(--icon-dev-backend)]/15', border: 'border-[var(--icon-dev-backend)]/25',
    defaultName: '后端工程师', defaultRole: 'API 与数据库设计',
  },
  qa: {
    icon: TestTube, color: 'text-[var(--icon-quality)]',
    bg: 'bg-[var(--icon-quality)]/15', border: 'border-[var(--icon-quality)]/25',
    defaultName: '测试工程师', defaultRole: '自动化与安全测试',
  },
  devops: {
    icon: Cloud, color: 'text-[var(--icon-ops)]',
    bg: 'bg-[var(--icon-ops)]/15', border: 'border-[var(--icon-ops)]/25',
    defaultName: 'DevOps', defaultRole: 'CI/CD 与部署运维',
  },
  fullstack: {
    icon: Zap, color: 'text-[var(--icon-dev-fullstack)]',
    bg: 'bg-[var(--icon-dev-fullstack)]/15', border: 'border-[var(--icon-dev-fullstack)]/25',
    defaultName: '全栈工程师', defaultRole: '跨领域快速开发',
  },
};

const DEFAULT_STYLE = {
  icon: Bot, color: 'text-[var(--da-text-muted)]',
  bg: 'bg-[var(--da-bg-surface)]', border: 'border-[var(--da-border)]',
  defaultName: 'Agent', defaultRole: '待配置角色',
};

/**
 * Convert a backend AgentConfig to the frontend Agent UI type.
 */
export function mapAgentConfigToAgent(cfg: AgentConfig): Agent {
  const style = ROLE_STYLE_MAP[cfg.role_identifier] || DEFAULT_STYLE;
  return {
    id: cfg.role_identifier,
    name: cfg.name || style.defaultName,
    role: style.defaultRole,
    icon: style.icon,
    color: style.color,
    bg: style.bg,
    border: style.border,
    systemPrompt: cfg.system_prompt,
    isConfigured: true,
  };
}

/**
 * Build teams from API-loaded agent configs.
 * Falls back to INITIAL_TEAMS if no agents are provided.
 */
export function buildTeamsFromAgents(agentConfigs: AgentConfig[] | undefined | null): Team[] {
  if (!agentConfigs || agentConfigs.length === 0) {
    return INITIAL_TEAMS;
  }

  const activeAgents = agentConfigs
    .filter(a => a.is_active)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const mappedAgents: Agent[] = activeAgents.map(mapAgentConfigToAgent);

  return [
    {
      id: 'team-dynamic',
      name: 'AI 开发团队',
      isExpanded: true,
      agents: mappedAgents,
    },
    {
      id: 'team-growth',
      name: '增长业务团队',
      isExpanded: false,
      agents: [],
    },
  ];
}

/**
 * Get all agents from teams as a flat array.
 */
export function getAllAgents(teams: Team[]): Agent[] {
  return teams.flatMap(t => t.agents);
}
