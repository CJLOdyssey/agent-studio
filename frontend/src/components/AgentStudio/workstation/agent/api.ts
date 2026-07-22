import type { AgentEntry, AgentFormData } from './agent.types';
import {
  listAgents,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
} from '../../../../api/client/agents';
import { listTeams } from '../../../../api/client/teams';
import { backendToEntry, resolveLists } from './mappers';

export interface AgentAPIService {
  fetchAll(): Promise<AgentEntry[]>;
  create(data: AgentFormData): Promise<AgentEntry>;
  update(id: string, data: Partial<AgentEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: AgentEntry): Promise<AgentEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
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
        (crypto.randomUUID?.()?.slice(0, 8) || Date.now().toString(36)),
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
