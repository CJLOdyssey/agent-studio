import { t } from './locales';

export function validateTeamForm(formData: { name: string }): string[] {
  const errs: string[] = [];
  if (!formData.name.trim()) errs.push(t('team.name_required'));
  else if (formData.name.length < 2 || formData.name.length > 50) errs.push(t('team.name_length'));
  return errs;
}

export const EMPTY_FORM = { name: '', description: '', status: 'active' as const, category: 'dev' as const };
