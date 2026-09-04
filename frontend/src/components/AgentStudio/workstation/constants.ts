import { useAvailableModels } from '../../../api/hooks';

// TODO: 对接 API 后替换为动态获取，见 _hardcoded-defaults.ts
export const MODEL_OPTIONS = ['GPT-4o', 'Claude Opus 4', 'Claude Sonnet 4', 'Gemini 2.5 Pro', 'DeepSeek V3', 'Qwen Max'];

/**
 * 从 API 返回可用模型名（key vault + /api/models）。
 * 未配置任何 key 时回退到硬编码的 MODEL_OPTIONS。
 */
export function useModelOptions(): string[] {
  const models = useAvailableModels();
  if (models.length > 0) return models.map((m) => m.id);
  return MODEL_OPTIONS;
}

export const PAGE_SIZE = 7;
