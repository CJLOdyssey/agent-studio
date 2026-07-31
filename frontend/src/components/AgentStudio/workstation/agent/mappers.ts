/** Data mapping utilities — back-end ↔ front-end type conversion. */

import type { AgentEntry } from './agent.types';
import type { AgentConfig } from '../../../../types';
import { listPrompts } from '../../../../api/client/prompts';
import { listTools, listToolPlugins } from '../../../../api/client/tools';
import { listMCPs } from '../../../../api/client/mcps';
import { listSkills } from '../../../../api/client/skills';

/* ── Internal helpers ─────────────────────────────────────────── */

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

/* ── Public API ───────────────────────────────────────────────── */

export function backendToEntry(item: AgentConfig): AgentEntry {
  const meta = parseMeta(item.output_constraints);
  const tools = parseJsonArr(item.tools) as Array<Record<string, string>>;
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
    toolIds: tools.map((t) => t.id || t.name || ''),
    mcpIds: (parseJsonArr(item.mcp) as Array<Record<string, string>>).map((m) => m.id || m.name || ''),
    skillIds: (parseJsonArr(item.skills) as Array<Record<string, string>>).map((s) => s.id || s.name || ''),
    createdAt: item.created_at ? item.created_at.slice(0, 10) : '',
  };
}

export async function resolveLists(
  systemPromptId: string,
  toolIds: string[],
  mcpIds: string[],
  skillIds: string[],
) {
  const [allPrompts, allTools, allPlugins, allMcps, allSkills] = await Promise.all([
    listPrompts().catch(() => [] as { id: string; name: string; content: string }[]),
    listTools().catch(() => [] as { id: string; name: string; description: string }[]),
    listToolPlugins().catch(() => [] as { tool_name: string; label: string; description: string }[]),
    listMCPs().catch(() => [] as { id: string; name: string; endpoint: string }[]),
    listSkills().catch(() => [] as { id: string; name: string; description: string }[]),
  ]);

  const system_prompt = allPrompts.find((p) => p.id === systemPromptId || p.name === systemPromptId)?.content ?? '';
  const pluginTools = allPlugins.map((p) => ({ id: p.tool_name, name: p.label, description: p.description }));
  const dbTools = allTools.map((t) => ({ id: t.id, name: t.name, description: t.description }));
  const tools = [...dbTools, ...pluginTools].filter((t) => toolIds.includes(t.id) || toolIds.includes(t.name)).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    enabled: true,
  }));
  const mcp = allMcps.filter((m) => mcpIds.includes(m.id) || mcpIds.includes(m.name)).map((m) => ({
    id: m.id,
    name: m.name,
    serverUrl: m.endpoint || '',
    enabled: true,
  }));
  const skills = allSkills.filter((s) => skillIds.includes(s.id) || skillIds.includes(s.name)).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    enabled: true,
  }));

  return { system_prompt, tools, mcp, skills };
}
