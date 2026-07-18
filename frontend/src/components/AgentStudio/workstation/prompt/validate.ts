import type { PromptEntry, PromptFormData } from './types';

export function validatePromptForm(data: PromptFormData, items: PromptEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('提示词名称不能为空');
  else if (t.length < 2) errors.push('提示词名称至少 2 个字符');
  else if (t.length > 50) errors.push('提示词名称最多 50 个字符');
  if (items.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!data.content.trim()) errors.push('提示词内容不能为空');
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  return errors;
}
