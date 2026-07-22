import type { OutputEntry, OutputCategory } from './output.types';

export const OUTPUT_CATEGORIES: OutputCategory[] = ['格式约束', '内容约束', '语言约束', '长度约束'];

export const OUTPUT_STATUS_LABEL: Record<OutputEntry['status'], string> = {
  active: '已启用',
  draft: '草稿',
  archived: '已归档',
};
