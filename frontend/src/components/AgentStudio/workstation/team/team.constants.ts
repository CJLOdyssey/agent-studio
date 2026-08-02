export function getCategoryLabel(value: string): string {
  return value;
}

export const TEAM_STATUS_LABEL: Record<string, string> = {
  active: '已启用',
  disabled: '已停用',
};

export { getCategoryTagClass } from '../shared/categoryTag';
