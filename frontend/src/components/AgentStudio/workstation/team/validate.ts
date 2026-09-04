import { t } from './locales';

interface TeamLike { id: string; name: string; }

export function validateTeamForm(
  formData: { name: string; category?: string },
  items: TeamLike[] = [],
  editingId?: string,
): string[] {
  const errs: string[] = [];
  const name = formData.name.trim();
  if (!name) errs.push(t('team.name_required'));
  else if (name.length < 2 || name.length > 50) errs.push(t('team.name_length'));
  else if (items.some((p) => p.name === name && p.id !== editingId)) errs.push(`名称「${name}」已存在`);
  if (formData.category && formData.category.trim() !== formData.category) {
    errs.push('分类首尾不能有空格');
  }
  return errs;
}

export const EMPTY_FORM = { name: '', description: '', status: 'active' as const, category: '' };
