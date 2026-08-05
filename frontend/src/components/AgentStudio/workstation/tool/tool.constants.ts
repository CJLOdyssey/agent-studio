import type { ToolEntry } from './tool.types';

export const TOOL_STATUS_LABEL: Record<ToolEntry['status'], string> = {
  active: '已启用',
  disabled: '已禁用',
};
