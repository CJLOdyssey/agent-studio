import api from './instance';

export async function submitRequirement(
  requirement: string,
  session_id?: string,
  key_id?: string,
  model?: string,
  agent_id?: string,
): Promise<{ run_id: string; status: string; session_id?: string }> {
  const { data } = await api.post('/runs', {
    requirement,
    session_id,
    key_id: key_id || undefined,
    model: model || undefined,
    agent_id: agent_id || undefined,
  });
  return data;
}
