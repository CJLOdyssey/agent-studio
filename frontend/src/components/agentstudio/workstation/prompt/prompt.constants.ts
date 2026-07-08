import type { PromptEntry } from './prompt.types';

/** Prompt categories for classification filtering */
export const PROMPT_CATEGORIES = ['系统', '自定义', '模板'];

/** Human-readable labels for PromptEntry.status values */
export const PROMPT_STATUS_LABEL: Record<PromptEntry['status'], string> = {
  active: '已启用',
  draft: '草稿',
  archived: '已归档',
};
