const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '—';

  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < MINUTE) return '刚刚';

  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;

  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);
  const calendarDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / DAY);
  if (calendarDays === 1) return '昨天';

  if (calendarDays < 7) return `${calendarDays} 天前`;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
