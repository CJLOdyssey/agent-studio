import type { MCPEntry, MCPFormData } from './mcp.types';

export const EMPTY_FORM: MCPFormData = {
  name: '', description: '', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: '', url: '',
};

export function validateMCPForm(data: MCPFormData, items: MCPEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('MCP 名称不能为空');
  else if (t.length < 2) errors.push('MCP 名称至少 2 个字符');
  else if (t.length > 50) errors.push('MCP 名称最多 50 个字符');
  if (items.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  if (data.type === 'stdio' && !data.command.trim()) errors.push('stdio 类型需要填写启动命令');
  if (data.type === 'sse' && !data.url.trim()) errors.push('sse 类型需要填写服务地址');
  return errors;
}
