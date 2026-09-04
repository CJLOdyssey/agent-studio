import { useEffect, useState } from 'react';

/**
 * 订阅系统深色模式偏好。
 *
 * 监听器注册与注销都在 effect 内完成（此前成本页版本在渲染体里
 * addEventListener，每次渲染泄漏一个监听器）。
 */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDark;
}
