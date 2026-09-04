import api from './instance';

export async function getPreferences(): Promise<Record<string, unknown>> {
  const { data } = await api.get('/preferences');
  return data;
}

export async function setPreference(key: string, value: unknown): Promise<void> {
  await api.put('/preferences', { key, value });
}
