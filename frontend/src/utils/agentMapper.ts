import { Bot, type LucideIcon } from 'lucide-react';
import type { AgentConfig } from '../types';
import type { Agent, Team } from '../types/agentstudio';

const DEFAULT_ICON: LucideIcon = Bot;
const DEFAULT_COLOR = 'text-[var(--da-text-muted)]';
const DEFAULT_BG = 'bg-[var(--da-bg-surface)]';
const DEFAULT_BORDER = 'border-[var(--da-border)]';

/**
 * Convert a backend AgentConfig to the frontend Agent UI type.
 * All agent info comes from the API, no hardcoded role defaults.
 */
export function mapAgentConfigToAgent(cfg: AgentConfig): Agent {
  return {
    id: cfg.role_identifier,
    name: cfg.name || cfg.role_identifier,
    role: cfg.role_identifier,
    icon: DEFAULT_ICON,
    color: DEFAULT_COLOR,
    bg: DEFAULT_BG,
    border: DEFAULT_BORDER,
    systemPrompt: cfg.system_prompt,
    isConfigured: true,
  };
}

/**
 * Build teams from API-loaded agent configs.
 * Returns empty array when no agents exist.
 */
export function buildTeamsFromAgents(agentConfigs: AgentConfig[] | undefined | null): Team[] {
  if (!agentConfigs || agentConfigs.length === 0) {
    return [];
  }

  const activeAgents = agentConfigs.filter((a) => a.is_active).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const mappedAgents: Agent[] = activeAgents.map(mapAgentConfigToAgent);

  return [
    {
      id: 'team-api',
      name: '我的团队',
      isExpanded: true,
      isPinned: false,
      agents: mappedAgents,
    },
  ];
}

/**
 * Get all agents from teams as a flat array.
 */
export function getAllAgents(teams: Team[]): Agent[] {
  return teams.flatMap((t) => t.agents);
}
