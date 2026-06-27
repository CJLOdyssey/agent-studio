import { useAvailableModels } from '../../../api/hooks';

export const TEAM_OPTIONS = ['前端团队', '后端团队', '全栈团队', '质量团队', '运维团队', '产品团队'];

export const MODEL_OPTIONS = ['GPT-4o', 'Claude Opus 4', 'Claude Sonnet 4', 'Gemini 2.5 Pro', 'DeepSeek V3', 'Qwen Max'];

/**
 * Returns available model names from the API (key vault + /api/models).
 * Falls back to hardcoded MODEL_OPTIONS when no keys are configured.
 */
export function useModelOptions(): string[] {
  const models = useAvailableModels();
  if (models.length > 0) return models.map((m) => m.id);
  return MODEL_OPTIONS;
}

export const PAGE_SIZE = 5;
