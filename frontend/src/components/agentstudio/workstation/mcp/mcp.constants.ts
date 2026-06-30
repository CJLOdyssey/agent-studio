import type { MCPEntry } from './mcp.types';

export const MCP_TYPE_OPTIONS = ['stdio', 'sse'];

export const MCP_STATUS_LABEL: Record<MCPEntry['status'], string> = {
  connected: '已连接',
  disconnected: '未连接',
  error: '异常',
};
