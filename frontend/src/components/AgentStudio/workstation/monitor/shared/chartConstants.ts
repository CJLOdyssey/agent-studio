/**
 * 图表与徽标的显示常量。
 *
 * 此前 CostTrendChart 与 UsageHistoryTable 各维护一份模型别名表，
 * 且同一模型两处显示不同（DeepSeek V4 / DeepSeek V4 Flash）；
 * 配色数组同样重复。这里收敛为唯一来源。
 */

export const CHART_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
] as const;

export function colorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

const MODEL_ALIASES: Record<string, string> = {
  'deepseek-ai/DeepSeek-V4-Flash': 'DeepSeek V4 Flash',
  'deepseek-ai/DeepSeek-V4-Pro': 'DeepSeek V4 Pro',
  'deepseek-ai/DeepSeek-V3-0324': 'DeepSeek V3',
  'THUDM/GLM-Z1-9B-0414': 'GLM-Z1-9B',
  'Qwen/Qwen3-8B': 'Qwen3-8B',
  'Qwen/Qwen3-14B': 'Qwen3-14B',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct': 'Llama 4 Scout',
  'google/gemma-3-27b-it': 'Gemma 3 27B',
};

/** 展示用短名；未登记的模型退回路径末段。 */
export function getModelAlias(model: string): string {
  return MODEL_ALIASES[model] || model.split('/').pop() || model;
}

const MODEL_BADGE_CLASSES: Record<string, string> = {
  deepseek: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  qwen: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  glm: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  llama: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  gemma: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  claude: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const MODEL_BADGE_FALLBACK = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';

export function getModelBadgeClass(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, cls] of Object.entries(MODEL_BADGE_CLASSES)) {
    if (lower.includes(key)) return cls;
  }
  return MODEL_BADGE_FALLBACK;
}
