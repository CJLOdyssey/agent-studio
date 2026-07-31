export function getCategoryLabel(value: string): string {
  return value;
}

export const TEAM_STATUS_LABEL: Record<string, string> = {
  active: '已启用',
  disabled: '已停用',
};

const TAG_COLORS = ['wsta-tag-indigo', 'wsta-tag-green', 'wsta-tag-amber', 'wsta-tag-blue', 'wsta-tag-purple', 'wsta-tag-pink'];

export function getCategoryTagClass(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash) + category.charCodeAt(i);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
