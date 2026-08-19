import client from './instance';

export interface SloDefinition {
  id: string;
  name: string;
  metricType: string;
  targetPercent: number;
  windowDays: number;
  teamId: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SloBudgetSnapshot {
  targetPercent: number;
  windowSeconds: number;
  totalRequests: number;
  errorCount: number;
  sliPercent: number;
  budgetRemainingPercent: number;
  burnRate: number;
}

export async function fetchSloDefinitions(): Promise<SloDefinition[]> {
  const resp = await client.get('/slo/definitions');
  return resp.data;
}

export async function createSloDefinition(input: {
  name: string;
  metricType: string;
  targetPercent: number;
  windowDays: number;
}): Promise<SloDefinition> {
  const resp = await client.post('/slo/definitions', input);
  return resp.data;
}

export async function updateSloDefinition(sliId: string, input: Partial<{ targetPercent: number; enabled: boolean; name: string }>): Promise<SloDefinition> {
  const resp = await client.put(`/slo/definitions/${sliId}`, input);
  return resp.data;
}

export async function deleteSloDefinition(sliId: string): Promise<void> {
  await client.delete(`/slo/definitions/${sliId}`);
}

export async function fetchSloBudget(targetPercent: number, windowSeconds: number): Promise<SloBudgetSnapshot> {
  const resp = await client.get('/slo/budget', { params: { target_percent: targetPercent, window_seconds: windowSeconds } });
  return resp.data;
}