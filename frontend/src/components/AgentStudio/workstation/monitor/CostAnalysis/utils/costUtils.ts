import type {
  BudgetStatus,
  CostSummary,
  UsageHistoryItem,
} from '../../../../../../api/client/cost';

/** CSV 导出：带 BOM，保证 Excel 正确识别 UTF-8。 */
export function exportToCsv(rows: UsageHistoryItem[], filename?: string): void {
  const header = ['日期', '模型', '输入', '输出', '总成本 Token', '成本', '会话'];
  const lines = rows.map((r) => [
    r.date,
    r.model,
    r.prompt_tokens,
    r.completion_tokens,
    r.total_tokens,
    r.cost_usd.toFixed(6),
    r.run_id,
  ]);
  const csv = [header, ...lines]
    .map((line) => line.map(escapeCsvCell).join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename || `cost-usage-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface BudgetAlert {
  type: 'danger' | 'warning';
  msg: string;
}

/** 预算告警 / 进度条共享的“临限”阈值（单一来源，避免重复硬编码）。 */
export const BUDGET_WARNING_THRESHOLD = 80;

/** 预算告警：超支优先于临限，日预算优先于月预算。 */
export function getBudgetAlert(budget: BudgetStatus | null): BudgetAlert | null {
  if (!budget) return null;
  if (budget.daily_exceeded) {
    return {
      type: 'danger',
      msg: `日预算已超出！今日已花费 $${budget.daily_spend.toFixed(4)} / 限额 $${budget.daily_limit.toFixed(2)}`,
    };
  }
  if (budget.monthly_exceeded) {
    return {
      type: 'danger',
      msg: `月预算已超出！本月已花费 $${budget.monthly_spend.toFixed(4)} / 限额 $${budget.monthly_limit.toFixed(2)}`,
    };
  }
  if (budget.daily_limit > 0 && budget.daily_percent >= BUDGET_WARNING_THRESHOLD) {
    return {
      type: 'warning',
      msg: `日预算即将用尽：${budget.daily_percent}%（$${budget.daily_spend.toFixed(4)} / $${budget.daily_limit.toFixed(2)}）`,
    };
  }
  if (budget.monthly_limit > 0 && budget.monthly_percent >= BUDGET_WARNING_THRESHOLD) {
    return {
      type: 'warning',
      msg: `月预算即将用尽：${budget.monthly_percent}%（$${budget.monthly_spend.toFixed(4)} / $${budget.monthly_limit.toFixed(2)}）`,
    };
  }
  return null;
}

/** 预算是否已被配置（0 表示未设置，不应展示进度）。 */
export function isBudgetConfigured(budget: BudgetStatus | null): boolean {
  return Boolean(budget) && ((budget?.daily_limit ?? 0) > 0 || (budget?.monthly_limit ?? 0) > 0);
}

export interface CostMetrics {
  avgCostPerCall: number;
  avgTokensPerCall: number;
  modelCount: number;
  /** 区间内日均成本 */
  avgDailyCost: number;
  topModel: { name: string; costUsd: number; percentage: number } | null;
}

export function calculateCostMetrics(summary: CostSummary, spanDays: number): CostMetrics {
  const total = summary.total_cost_usd;
  const topEntry = Object.entries(summary.by_model).sort(
    (a, b) => b[1].cost_usd - a[1].cost_usd,
  )[0];

  return {
    avgCostPerCall: summary.total_calls > 0 ? total / summary.total_calls : 0,
    avgTokensPerCall: summary.total_calls > 0 ? summary.total_tokens / summary.total_calls : 0,
    modelCount: Object.keys(summary.by_model).length,
    avgDailyCost: spanDays > 0 ? total / spanDays : total,
    topModel: topEntry
      ? {
          name: topEntry[0],
          costUsd: topEntry[1].cost_usd,
          percentage: total > 0 ? (topEntry[1].cost_usd / total) * 100 : 0,
        }
      : null,
  };
}

/**
 * 计算「好看的」坐标轴步长（1 / 2 / 5 × 10^n）。
 * 替代此前固定的 0.001，使成本跨度大时 Y 轴不至于被压平。
 */
export function niceStep(maxValue: number, targetTicks = 5): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;
  const rough = maxValue / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return factor * magnitude;
}
