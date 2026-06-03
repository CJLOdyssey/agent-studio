import api from './instance';

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
}

export async function listModels(): Promise<ModelInfo[]> {
  const { data } = await api.get('/models');
  return data;
}

export interface CommandDef {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  category?: string;
  requires_input?: boolean;
  enabled?: boolean;
}

export async function listCommands(): Promise<CommandDef[]> {
  const { data } = await api.get('/commands');
  return data;
}

export async function executeCommand(
  commandId: string,
  sessionId: string,
  payload?: Record<string, unknown>,
): Promise<{ success: boolean; message: string; data: Record<string, unknown> }> {
  const { data } = await api.post('/commands/execute', {
    command_id: commandId,
    session_id: sessionId,
    payload: payload ?? {},
  });
  return data;
}
