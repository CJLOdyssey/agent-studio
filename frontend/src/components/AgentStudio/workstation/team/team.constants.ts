import { listTeamCategories } from '../../../../api/client/teams';

const FALLBACK_CATEGORIES: { value: string; label: string }[] = [
  { value: 'dev', label: '开发' },
  { value: 'ops', label: '运维' },
  { value: 'test', label: '测试' },
];

export let TEAM_CATEGORIES = [...FALLBACK_CATEGORIES];

export async function loadTeamCategories() {
  try {
    TEAM_CATEGORIES = await listTeamCategories();
  } catch {}
}

export function getCategoryLabel(value: string): string {
  return TEAM_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

export const TEAM_STATUS_LABEL: Record<string, string> = {
  active: '活跃',
  inactive: '停用',
};

export const CATEGORY_LABEL: Record<string, string> = {
  dev: '开发',
  ops: '运维',
  test: '测试',
};
