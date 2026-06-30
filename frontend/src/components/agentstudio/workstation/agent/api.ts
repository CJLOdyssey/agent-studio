import type { AgentEntry, AgentFormData } from './agent.types';
import type { AgentConfig } from '../../../../types';
import {
  listAgents,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
} from '../../../../api/client/agents';
import { listTeams } from '../../../../api/client/teams';
import { listPrompts } from '../../../../api/client/prompts';
import { listTools } from '../../../../api/client/tools';
import { listMCPs } from '../../../../api/client/mcps';
import { listSkills } from '../../../../api/client/skills';

export interface AgentAPIService {
  fetchAll(): Promise<AgentEntry[]>;
  create(data: AgentFormData): Promise<AgentEntry>;
  update(id: string, data: Partial<AgentEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: AgentEntry): Promise<AgentEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
}

function parseMeta(val: string | null | undefined): Record<string, string> {
  if (!val) return {};
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

function parseJsonArr(val: unknown): unknown[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return [];
}

function backendToEntry(item: AgentConfig): AgentEntry {
  const meta = parseMeta(item.output_constraints);
  return {
    id: item.id,
    name: item.name,
    description: meta.description || '',
    team: meta.team || '',
    teams: [],
    model: item.model || '',
    status: item.is_active ? 'running' : 'stopped',
    version: meta.version || 'v1.0.0',
    systemPromptId: meta.systemPromptId || '',
    toolIds: (parseJsonArr(item.tools) as Array<Record<string, string>>).map((t) => t.id || t.name || ''),
    mcpIds: (parseJsonArr(item.mcp) as Array<Record<string, string>>).map((m) => m.id || m.name || ''),
    skillIds: (parseJsonArr(item.skills) as Array<Record<string, string>>).map((s) => s.id || s.name || ''),
    createdAt: item.created_at ? item.created_at.slice(0, 10) : '',
  };
}

async function resolveLists(
  systemPromptId: string,
  toolIds: string[],
  mcpIds: string[],
  skillIds: string[],
) {
  const [allPrompts, allTools, allMcps, allSkills] = await Promise.all([
    listPrompts().catch(() => [] as { id: string; content: string }[]),
    listTools().catch(() => [] as { id: string; name: string; description: string }[]),
    listMCPs().catch(() => [] as { id: string; name: string; endpoint: string }[]),
    listSkills().catch(() => [] as { id: string; name: string; description: string }[]),
  ]);

  const selectedPrompt = allPrompts.find((p) => p.id === systemPromptId);
  const system_prompt = selectedPrompt?.content || systemPromptId || '';

  const tools = toolIds.map((id) => {
    const t = allTools.find((x) => x.id === id);
    return t
      ? { id: t.id, name: t.name, description: t.description, enabled: true }
      : { id, name: id, description: '', enabled: true };
  });
  const mcp = mcpIds.map((id) => {
    const m = allMcps.find((x) => x.id === id);
    return m
      ? { id: m.id, name: m.name, serverUrl: m.endpoint || '', enabled: true }
      : { id, name: id, serverUrl: '', enabled: true };
  });
  const skills = skillIds.map((id) => {
    const s = allSkills.find((x) => x.id === id);
    return s
      ? { id: s.id, name: s.name, description: s.description, enabled: true }
      : { id, name: id, description: '', enabled: true };
  });

  return { system_prompt, tools, mcp, skills };
}

const realImpl: AgentAPIService = {
  fetchAll: async () => {
    const [items, teamItems] = await Promise.all([
      listAgents(),
      listTeams().catch(() => []),
    ]);
    const agentToTeams = new Map<string, string[]>();
    for (const team of teamItems) {
      for (const member of team.agents) {
        if (member.agentConfigId) {
          const existing = agentToTeams.get(member.agentConfigId) ?? [];
          existing.push(team.name);
          agentToTeams.set(member.agentConfigId, existing);
        }
      }
    }
    return items.map((item) => {
      const entry = backendToEntry(item);
      entry.teams = agentToTeams.get(item.id) ?? [];
      return entry;
    });
  },

  create: async (data) => {
    const { system_prompt, tools, mcp, skills } = await resolveLists(
      data.systemPromptId,
      data.toolIds,
      data.mcpIds,
      data.skillIds,
    );

    const result = await apiCreateAgent({
      name: data.name,
      role_identifier:
        'agent_' +
        (crypto.randomUUID()?.slice(0, 8) || Date.now().toString(36)),
      system_prompt,
      output_constraints: JSON.stringify({
        description: data.description,
        team: data.team,
        version: data.version,
        systemPromptId: data.systemPromptId,
      }),
      tools,
      mcp,
      skills,
      order: 0,
      is_active: data.status === 'running',
      is_approver: false,
      icon: '🤖',
      model: data.model,
    });

    return {
      id: result.id,
      ...data,
      teams: [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
  },

  update: async (id, raw) => {
    const d = raw as unknown as AgentFormData;

    const { system_prompt, tools, mcp, skills } = await resolveLists(
      d.systemPromptId,
      d.toolIds,
      d.mcpIds,
      d.skillIds,
    );

    await apiUpdateAgent(id, {
      name: d.name,
      system_prompt,
      output_constraints: JSON.stringify({
        description: d.description,
        team: d.team,
        version: d.version,
        systemPromptId: d.systemPromptId,
      }),
      tools,
      mcp,
      skills,
      is_active: d.status === 'running',
      model: d.model,
    });
  },

  remove: async (id) => {
    await apiDeleteAgent(id);
  },

  clone: async (item) => {
    return realImpl.create({
      name: `${item.name.slice(0, 28)} (副本)`,
      description: item.description,
      team: item.team,
      model: item.model,
      status: 'stopped',
      version: item.version,
      systemPromptId: item.systemPromptId,
      toolIds: item.toolIds,
      mcpIds: item.mcpIds,
      skillIds: item.skillIds,
    });
  },

  removeBatch: async (ids) => {
    await Promise.all(Array.from(ids).map(apiDeleteAgent));
  },
};

export let agentAPI: AgentAPIService = realImpl;

export function setAgentAPI(api: AgentAPIService): void {
  agentAPI = api;
}
