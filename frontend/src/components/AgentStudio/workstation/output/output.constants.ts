import type { OutputEntry } from './output.types';

export const OUTPUT_STATUS_LABEL: Record<OutputEntry['status'], string> = {
  active: '已启用',
  draft: '草稿',
  archived: '已归档',
};
