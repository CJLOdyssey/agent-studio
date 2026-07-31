import type { OutputEntry } from './output.types';
import { t } from './locales';

export const OUTPUT_STATUS_LABEL: Record<OutputEntry['status'], string> = {
  active: t('output.status_active'),
  draft: t('output.status_draft'),
  archived: t('output.status_archived'),
};
