import type { PromptEntry } from './types';
import { t } from './locales';

/** Human-readable labels for PromptEntry.status values — reads from i18n */
export const PROMPT_STATUS_LABEL: Record<PromptEntry['status'], string> = {
  active: t('status.active'),
  draft: t('status.draft'),
  archived: t('status.archived'),
};

/** Human-readable labels for PromptEntry.category values — reads from i18n */
export function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    system: t('workstation.prompt_category_system'),
    user: t('workstation.prompt_category_user'),
    meta: t('workstation.prompt_category_meta'),
    output_constraint: t('workstation.prompt_category_output_constraint'),
  };
  return map[cat] || cat;
}

/** @deprecated Use getCategoryLabel() for i18n-aware labels.
 *  Static snapshot — will NOT react to language changes after module load. */
const _snapshot: Record<string, string> = {
  system: t('workstation.prompt_category_system'),
  user: t('workstation.prompt_category_user'),
  meta: t('workstation.prompt_category_meta'),
  output_constraint: t('workstation.prompt_category_output_constraint'),
};
export const PROMPT_CATEGORY_LABEL: Record<string, string> = _snapshot;
