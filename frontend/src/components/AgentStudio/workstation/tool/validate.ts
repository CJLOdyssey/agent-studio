import type { ToolEntry, ToolFormData } from './tool.types';

export const EMPTY_FORM: ToolFormData = {
  name: '', description: '', category: '自定义工具', status: 'active', version: 'v1.0.0', endpoint: '', method: 'GET', headers: '{}', parameters: '{"type":"object","properties":{}}',
};

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function validateToolForm(data: ToolFormData, items: ToolEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('工具名称不能为空');
  else if (t.length < 2) errors.push('工具名称至少 2 个字符');
  else if (t.length > 50) errors.push('工具名称最多 50 个字符');
  if (items.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!data.description.trim()) errors.push('工具描述不能为空');
  const cat = data.category;
  if (cat && cat !== cat.trim()) errors.push('分类首尾不能有空格');
  if (data.version.trim() && !/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  if (!isValidJson(data.parameters)) errors.push('参数必须为合法 JSON');
  return errors;
}
