const TAG_COLORS = ['wsta-tag-indigo', 'wsta-tag-green', 'wsta-tag-amber', 'wsta-tag-blue', 'wsta-tag-purple', 'wsta-tag-pink'];

export function getCategoryTagClass(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash) + category.charCodeAt(i);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
