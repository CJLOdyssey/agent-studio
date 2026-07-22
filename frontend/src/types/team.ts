export interface TeamMember {
  id: string;
  name: string;
  role: string;
  order: number;
  agentConfigId: string | null;
  systemPrompt: string | null;
  outputConstraints: string | null;
  tools: unknown[];
  mcp: unknown[];
  skills: unknown[];
}

export interface TeamDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  order: number;
  isExpanded: boolean;
  agents: TeamMember[];
  createdAt: string | null;
}

export interface TeamFormPayload {
  name: string;
  description?: string;
  status?: string;
  order?: number;
  is_expanded?: boolean;
}

export interface MemberAddPayload {
  name: string;
  role?: string;
  agent_config_id?: string;
}
