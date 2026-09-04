import { useMemo } from 'react';
import type { Team } from '../types/AgentStudio';
import type { CommandOption } from '../types/input';

/**
 * 从团队 agent 启用的 MCP 服务器和 skills 派生斜杠命令。
 *
 * 每个启用的 MCP 服务器成为一个以 agent 角色为前缀的命令。
 * 每个启用的 skill 成为一个命令。
 *
 * 输出示例：
 *   /github:search-code   （前端 agent 的 GitHub MCP）
 *   /slack:post-message   （pm agent 的 Slack MCP）
 *   /code-review          （架构师 agent 的 skill）
 */
export function useAgentCommands(teams: Team[]): CommandOption[] {
  return useMemo(() => {
    const commands: CommandOption[] = [];
    const seen = new Set<string>();

    for (const team of teams) {
      for (const agent of team.agents) {
        // Agent 启用的 MCP 服务器 → 命令
        if (agent.mcp) {
          for (const mcp of agent.mcp) {
            if (!mcp.enabled) continue;
            const id = `mcp:${mcp.id}`;
            if (seen.has(id)) continue;
            seen.add(id);
            commands.push({
              id,
              name: mcp.name,
              description: `${agent.name} · ${mcp.serverUrl}`,
              source: 'agent',
            });
          }
        }

        // Agent 启用的 skills → 命令
        if (agent.skills) {
          for (const skill of agent.skills) {
            if (!skill.enabled) continue;
            const id = `skill:${skill.id}`;
            if (seen.has(id)) continue;
            seen.add(id);
            commands.push({
              id,
              name: skill.name,
              description: `${agent.name} · ${skill.description}`,
              source: 'agent',
            });
          }
        }

        // Agent 启用的工具 → 命令
        if (agent.tools) {
          for (const tool of agent.tools) {
            if (!tool.enabled) continue;
            const id = `tool:${tool.id}`;
            if (seen.has(id)) continue;
            seen.add(id);
            commands.push({
              id,
              name: tool.name,
              description: `${agent.name} · ${tool.description}`,
              source: 'agent',
            });
          }
        }
      }
    }

    return commands;
  }, [teams]);
}
