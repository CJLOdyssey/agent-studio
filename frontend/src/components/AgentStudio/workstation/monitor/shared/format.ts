/**
 * 展示层格式化工具。
 *
 * 此前 formatCost / formatTokens / formatDate / formatSessionId 在
 * costUtils、UsageHistoryTable 等处各有一份实现，
 * 且阈值不一致；这里收敛为唯一实现。
 */

export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.0001) return '< $0.0001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(Math.round(tokens));
}

/** 明细表用的完整千分位（与图表的 K/M 缩写区分开）。 */
export function formatTokenCount(tokens: number): string {
  return Math.round(tokens).toLocaleString('en-US');
}

export function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateStr;
  }
}

export function formatSessionId(runId: string): string {
  const cleaned = runId.replace(/^(session-|run-|chat-)/, '');
  if (cleaned.length <= 12) return cleaned;
  return `${cleaned.slice(0, 8)}...${cleaned.slice(-4)}`;
}

export function formatRelativeTime(date: Date, now = Date.now()): string {
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 10) return '刚刚';
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  return `${Math.floor(diff / 3600)}小时前`;
}
