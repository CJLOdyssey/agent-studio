import type { PromptEntry } from './types';

/** Human-readable labels for PromptEntry.status values */
export const PROMPT_STATUS_LABEL: Record<PromptEntry['status'], string> = {
  active: '已启用',
  draft: '草稿',
  archived: '已归档',
};

import { t } from './locales';

/** Human-readable labels for PromptEntry.category values — reads from i18n */
export function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    system: t('prompt_category_system'),
    user: t('prompt_category_user'),
    meta: t('prompt_category_meta'),
    output_constraint: t('prompt_category_output_constraint'),
  };
  return map[cat] || cat;
}

/** @deprecated Use getCategoryLabel() for i18n-aware labels.
 *  Static snapshot — will NOT react to language changes after module load. */
const _snapshot: Record<string, string> = {
  system: t('prompt_category_system'),
  user: t('prompt_category_user'),
  meta: t('prompt_category_meta'),
  output_constraint: t('prompt_category_output_constraint'),
};
export const PROMPT_CATEGORY_LABEL: Record<string, string> = _snapshot;
