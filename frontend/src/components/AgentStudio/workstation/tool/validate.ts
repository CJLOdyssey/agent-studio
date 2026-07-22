import type { ToolEntry, ToolFormData } from './tool.types';

export const EMPTY_FORM: ToolFormData = {
  name: '', description: '', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.0.0', endpoint: '', parameters: '{"type":"object","properties":{}}',
};

export function validateToolForm(data: ToolFormData, items: ToolEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('工具名称不能为空');
  else if (t.length < 2) errors.push('工具名称至少 2 个字符');
  else if (t.length > 50) errors.push('工具名称最多 50 个字符');
  if (items.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  return errors;
}
