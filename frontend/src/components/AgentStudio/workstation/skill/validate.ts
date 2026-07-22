/**
 * Skill form validation — extracted from the old useSkillUI.ts.
 */

import type { SkillEntry, SkillFormData } from './skill.types';

export function validateSkillForm(data: SkillFormData, skills: SkillEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('Skill 名称不能为空');
  else if (t.length < 2) errors.push('Skill 名称至少 2 个字符');
  else if (t.length > 50) errors.push('Skill 名称最多 50 个字符');
  if (skills.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  return errors;
}
