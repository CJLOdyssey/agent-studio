import type { Agent, Team } from '../types/agentstudio';

/**
 * Get all agents from teams as a flat array.
 */
export function getAllAgents(teams: Team[]): Agent[] {
  return teams.flatMap((t) => t.agents);
}

