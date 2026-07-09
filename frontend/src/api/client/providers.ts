import client from './instance';

export interface ProviderInfo {
  name: string;
  base_url: string;
  capabilities: ('llm' | 'embedding')[];
  docs_url: string | null;
}

export type ProvidersMap = Record<string, ProviderInfo>;

export async function listProviders(): Promise<ProvidersMap> {
  const { data } = await client.get('/providers');
  return data;
}
