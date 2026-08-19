import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  type AppNotification,
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../../api/client/alerts';
import { useToast } from '../../../utils/useToast';

export function NotificationsBell() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [items, count] = await Promise.all([
        fetchNotifications({ limit: 20 }),
        fetchUnreadCount(),
      ]);
      setNotifications(items);
      setUnread(count);
    } catch {
      /* bell badge should never block the header — stay silent on failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling pattern (see WorkflowList)
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openNotification = async (n: AppNotification) => {
    if (n.readAt === null) {
      try {
        await markNotificationRead(n.id);
        setUnread((u) => Math.max(0, u - 1));
      } catch { /* ignore */ }
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.createdAt })));
      setUnread(0);
      toast('已全部标为已读', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-md text-[var(--color-text-secondary)] cursor-pointer relative transition-[color,background] duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-[2px] -right-[2px] min-w-4 h-4 px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] leading-4 text-center border-2 border-[var(--color-surface-card)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">通知</span>
            <button className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline cursor-pointer" onClick={readAll}>
              <CheckCheck size={13} /> 全部已读
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 && <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">加载中...</div>}
            {!loading && notifications.length === 0 && <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">暂无通知</div>}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={`block w-full text-left px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)] cursor-pointer ${n.readAt === null ? 'bg-[color-mix(in_srgb,var(--color-accent)_6%,transparent)]' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${n.readAt === null ? 'bg-[var(--color-accent)]' : 'bg-transparent'}`} />
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{n.title}</span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">{n.body}</p>
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{new Date(n.createdAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}