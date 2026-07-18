/** Agent form validation. */
import type { AgentEntry, AgentFormData } from './agent.types';

export function validateForm(data: AgentFormData, agents: AgentEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('Agent 名称不能为空');
  else if (t.length < 2) errors.push('Agent 名称至少 2 个字符');
  else if (t.length > 30) errors.push('Agent 名称最多 30 个字符');
  if (agents.some((a) => a.name === t && a.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  if (!data.systemPromptId.trim()) errors.push('请选择系统提示词');
  return errors;
}
