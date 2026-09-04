import client from './instance';

export interface AlertRule {
  id: string;
  name: string;
  metricType: string;
  operator: string;
  threshold: number;
  windowSeconds: number;
  severity: string;
  runbookUrl: string | null;
  cooldownSeconds: number;
  silenceUntil: string | null;
  teamId: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleInput {
  name: string;
  metricType: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte';
  threshold: number;
  windowSeconds: number;
  severity: 'P1' | 'P2' | 'P3';
  runbookUrl?: string | null;
  cooldownSeconds: number;
  teamId?: string | null;
}

export interface AlertRuleUpdateInput {
  name?: string;
  metricType?: string;
  operator?: string;
  threshold?: number;
  windowSeconds?: number;
  severity?: string;
  runbookUrl?: string | null;
  cooldownSeconds?: number;
  teamId?: string | null;
  enabled?: boolean;
  silenceUntil?: string | null;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  metricValue: number;
  threshold: number;
  severity: string;
  status: 'firing' | 'resolved' | 'acked';
  message: string;
  triggeredAt: string;
  resolvedAt: string | null;
  ackedAt: string | null;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Subscription {
  severity: string;
  teamId: string | null;
  enabled: boolean;
}

const METRIC_TYPES = ['success_rate', 'p95_latency', 'avg_latency', 'daily_cost', 'error_count'] as const;

export async function fetchAlertRules(params?: {
  limit?: number;
  offset?: number;
  enabled?: boolean;
  metric_type?: string;
}): Promise<AlertRule[]> {
  const resp = await client.get('/alerts/rules', { params });
  return resp.data;
}

export async function createAlertRule(input: AlertRuleInput): Promise<AlertRule> {
  const resp = await client.post('/alerts/rules', input);
  return resp.data;
}

export async function updateAlertRule(ruleId: string, input: AlertRuleUpdateInput): Promise<AlertRule> {
  const resp = await client.put(`/alerts/rules/${ruleId}`, input);
  return resp.data;
}

export async function deleteAlertRule(ruleId: string): Promise<void> {
  await client.delete(`/alerts/rules/${ruleId}`);
}

export async function silenceAlertRule(ruleId: string, silenceUntil: string | null): Promise<AlertRule> {
  const resp = await client.post(`/alerts/rules/${ruleId}/silence`, { silenceUntil });
  return resp.data;
}

export async function fetchAlertEvents(params?: {
  limit?: number;
  offset?: number;
  rule_id?: string;
  status?: string;
  severity?: string;
}): Promise<AlertEvent[]> {
  const resp = await client.get('/alerts/events', { params });
  return resp.data;
}

export async function ackAlertEvent(eventId: string): Promise<AlertEvent> {
  const resp = await client.post(`/alerts/events/${eventId}/ack`);
  return resp.data;
}

export async function fetchNotifications(params?: {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
}): Promise<AppNotification[]> {
  const resp = await client.get('/alerts/notifications', { params });
  return resp.data;
}

export async function markNotificationRead(notificationId: string): Promise<AppNotification> {
  const resp = await client.post(`/alerts/notifications/${notificationId}/read`);
  return resp.data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const resp = await client.post('/alerts/notifications/read-all');
  return resp.data.count;
}

export async function fetchUnreadCount(): Promise<number> {
  const resp = await client.get('/alerts/notifications/unread-count');
  return resp.data.count;
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const resp = await client.get('/alerts/subscriptions');
  return resp.data;
}

export async function replaceSubscriptions(subscriptions: Subscription[]): Promise<Subscription[]> {
  const resp = await client.put('/alerts/subscriptions', { subscriptions });
  return resp.data;
}

export { METRIC_TYPES };