import { describe, it, expect } from 'vitest';
import { MOCK_TOOLS, MOCK_TOOL_VERSIONS } from '../mocks/tool';
import { MOCK_MCPS, MOCK_MCP_VERSIONS } from '../mocks/mcp';
import { MOCK_PROMPTS, MOCK_PROMPT_VERSIONS } from '../mocks/prompt';
import { MOCK_SKILLS, MOCK_SKILL_VERSIONS } from '../mocks/skill';
import { MOCK_TEAMS, MOCK_TEAM_VERSIONS } from '../mocks/team';
import { MOCK_STATS, MOCK_ACTIVITY, MOCK_HEALTH } from '../mocks/monitor';
import { MOCK_OUTPUTS } from '../mocks/output';
import { MOCK_LOGS } from '../mocks/logs';
import { MOCK_AGENTS } from '../mocks/agent';

describe('mocks/tool', () => {
  it('exports MOCK_TOOLS array', () => {
    expect(Array.isArray(MOCK_TOOLS)).toBe(true);
    expect(MOCK_TOOLS.length).toBeGreaterThan(0);
  });

  it('exports MOCK_TOOL_VERSIONS', () => {
    expect(MOCK_TOOL_VERSIONS).toBeDefined();
    expect(Object.keys(MOCK_TOOL_VERSIONS).length).toBeGreaterThan(0);
  });
});

describe('mocks/mcp', () => {
  it('exports MOCK_MCPS array', () => {
    expect(Array.isArray(MOCK_MCPS)).toBe(true);
    expect(MOCK_MCPS.length).toBeGreaterThan(0);
  });

  it('exports MOCK_MCP_VERSIONS', () => {
    expect(MOCK_MCP_VERSIONS).toBeDefined();
  });
});

describe('mocks/prompt', () => {
  it('exports MOCK_PROMPTS array', () => {
    expect(Array.isArray(MOCK_PROMPTS)).toBe(true);
    expect(MOCK_PROMPTS.length).toBeGreaterThan(0);
  });

  it('exports MOCK_PROMPT_VERSIONS', () => {
    expect(MOCK_PROMPT_VERSIONS).toBeDefined();
  });
});

describe('mocks/skill', () => {
  it('exports MOCK_SKILLS array', () => {
    expect(Array.isArray(MOCK_SKILLS)).toBe(true);
    expect(MOCK_SKILLS.length).toBeGreaterThan(0);
  });

  it('exports MOCK_SKILL_VERSIONS', () => {
    expect(MOCK_SKILL_VERSIONS).toBeDefined();
  });
});

describe('mocks/team', () => {
  it('exports MOCK_TEAMS array', () => {
    expect(Array.isArray(MOCK_TEAMS)).toBe(true);
    expect(MOCK_TEAMS.length).toBeGreaterThan(0);
  });

  it('exports MOCK_TEAM_VERSIONS', () => {
    expect(MOCK_TEAM_VERSIONS).toBeDefined();
  });
});

describe('mocks/monitor', () => {
  it('exports MOCK_STATS array', () => {
    expect(Array.isArray(MOCK_STATS)).toBe(true);
    expect(MOCK_STATS.length).toBeGreaterThan(0);
  });

  it('exports MOCK_ACTIVITY array', () => {
    expect(Array.isArray(MOCK_ACTIVITY)).toBe(true);
    expect(MOCK_ACTIVITY.length).toBeGreaterThan(0);
  });

  it('exports MOCK_HEALTH array', () => {
    expect(Array.isArray(MOCK_HEALTH)).toBe(true);
    expect(MOCK_HEALTH.length).toBeGreaterThan(0);
  });
});

describe('mocks/output', () => {
  it('exports MOCK_OUTPUTS array', () => {
    expect(Array.isArray(MOCK_OUTPUTS)).toBe(true);
  });
});

describe('mocks/logs', () => {
  it('exports MOCK_LOGS array', () => {
    expect(Array.isArray(MOCK_LOGS)).toBe(true);
    expect(MOCK_LOGS.length).toBeGreaterThan(0);
  });
});

describe('mocks/agent', () => {
  it('exports MOCK_AGENTS array', () => {
    expect(Array.isArray(MOCK_AGENTS)).toBe(true);
    expect(MOCK_AGENTS.length).toBeGreaterThan(0);
  });
});
