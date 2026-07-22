import type { ToolEntry } from './tool.types';

export const TOOL_CATEGORIES = ['内置工具', '自定义工具'];

export const TOOL_STATUS_LABEL: Record<ToolEntry['status'], string> = {
  active: '已启用',
  disabled: '已禁用',
};
