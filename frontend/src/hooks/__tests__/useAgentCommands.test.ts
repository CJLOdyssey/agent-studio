import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgentCommands } from '../useAgentCommands';

describe('useAgentCommands', () => {
  it('returns empty array for empty teams', () => {
    const { result } = renderHook(() => useAgentCommands([]));
    expect(result.current).toEqual([]);
  });

  it('returns empty array for teams with no agents', () => {
    const { result } = renderHook(() => useAgentCommands([{ id: 't1', name: 'Team 1', agents: [] }] as never));
    expect(result.current).toEqual([]);
  });

  it('extracts MCP commands from agents', () => {
    const teams = [{
      id: 't1',
      name: 'Dev Team',
      agents: [{
        id: 'a1',
        name: 'Agent 1',
        mcp: [{ id: 'm1', name: 'GitHub', enabled: true, serverUrl: 'https://github.com' }],
        skills: [],
        tools: [],
      }],
    }];

    const { result } = renderHook(() => useAgentCommands(teams as never));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe('GitHub');
    expect(result.current[0].source).toBe('agent');
  });

  it('skips disabled MCP servers', () => {
    const teams = [{
      id: 't1',
      name: 'Team',
      agents: [{
        id: 'a1',
        name: 'Agent',
        mcp: [{ id: 'm1', name: 'Disabled', enabled: false, serverUrl: '' }],
        skills: [],
        tools: [],
      }],
    }];

    const { result } = renderHook(() => useAgentCommands(teams as never));
    expect(result.current).toEqual([]);
  });

  it('extracts skill commands', () => {
    const teams = [{
      id: 't1',
      name: 'Team',
      agents: [{
        id: 'a1',
        name: 'Agent',
        mcp: [],
        skills: [{ id: 's1', name: 'Code Review', enabled: true, description: 'Reviews code' }],
        tools: [],
      }],
    }];

    const { result } = renderHook(() => useAgentCommands(teams as never));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe('Code Review');
    expect(result.current[0].description).toContain('Agent');
  });

  it('extracts tool commands', () => {
    const teams = [{
      id: 't1',
      name: 'Team',
      agents: [{
        id: 'a1',
        name: 'Agent',
        mcp: [],
        skills: [],
        tools: [{ id: 'tool1', name: 'Search', enabled: true, description: 'Search tool' }],
      }],
    }];

    const { result } = renderHook(() => useAgentCommands(teams as never));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe('Search');
  });

  it('deduplicates by id', () => {
    const mcp = { id: 'm1', name: 'GitHub', enabled: true, serverUrl: 'https://github.com' };
    const teams = [{
      id: 't1',
      name: 'Team',
      agents: [
        { id: 'a1', name: 'Agent1', mcp: [mcp], skills: [], tools: [] },
        { id: 'a2', name: 'Agent2', mcp: [mcp], skills: [], tools: [] },
      ],
    }];

    const { result } = renderHook(() => useAgentCommands(teams as never));
    expect(result.current).toHaveLength(1);
  });

  it('handles agents without mcp, skills, or tools', () => {
    const teams = [{
      id: 't1',
      name: 'Team',
      agents: [{ id: 'a1', name: 'Agent' }],
    }];

    const { result } = renderHook(() => useAgentCommands(teams as never));
    expect(result.current).toEqual([]);
  });
});
