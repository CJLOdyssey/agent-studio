import type { PromptEntry } from './types';

/** Prompt categories for classification filtering */
export const PROMPT_CATEGORIES = ['系统提示词', '用户提示词', '任务模板', '角色定义'];

/** Human-readable labels for PromptEntry.status values */
export const PROMPT_STATUS_LABEL: Record<PromptEntry['status'], string> = {
  active: '已启用',
  draft: '草稿',
  archived: '已归档',
};
