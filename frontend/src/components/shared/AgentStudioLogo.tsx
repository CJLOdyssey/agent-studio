import { useEffect, useId, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

interface AgentStudioLogoProps {
  size?: number;
  className?: string;
}

/**
 * AgentStudio 品牌 logo：核心 Agent（中心火花）+ 环绕协作的多个子 Agent（轨道 + 节点）。
 *
 * 颜色随主题自适应（直接按主题选择色值，不依赖 color-mix）：
 * - 深色主题：深蓝渐变背景 + 白色图形
 * - 浅色主题：淡蓝（近白）渐变背景 + 深蓝图形
 *
 * 用 useId 避免同页多处实例时 SVG gradient id 冲突。
 */
export function AgentStudioLogo({ size = 32, className }: AgentStudioLogoProps) {
  const reactId = useId();
  const gradId = `as-${reactId.replace(/:/g, '')}`;
  const { settings } = useSettings();

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);

  const gradient = isDark
    ? ['#1d4ed8', '#2563eb', '#38bdf8'] // 深色主题：深蓝 → 亮青蓝
    : ['#eff6ff', '#dbeafe', '#bfdbfe']; // 浅色主题：淡蓝（近白）
  const fg = isDark ? '#ffffff' : '#1d4ed8'; // 图形：深色白 / 浅色深蓝

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="AgentStudio Logo"
    >
      <defs>
        <linearGradient id={`${gradId}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={gradient[0]} />
          <stop offset="0.55" stopColor={gradient[1]} />
          <stop offset="1" stopColor={gradient[2]} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradId}-bg)`} />
      <rect width="32" height="32" rx="9" fill={fg} opacity="0.08" />
      <ellipse cx="16" cy="16.5" rx="12" ry="4.8" fill="none" stroke={fg} strokeOpacity="0.22" strokeWidth="1.1" transform="rotate(-28 16 16.5)" />
      <circle cx="25.5" cy="9.5" r="2" fill={fg} />
      <circle cx="6.5" cy="22.5" r="1.4" fill={fg} opacity="0.65" />
      <circle cx="20.5" cy="24" r="1.1" fill={fg} opacity="0.4" />
      <path d="M16 11.5 C16.5 14.5 17.3 16.5 20.5 16.5 C17.3 16.5 16.5 18.5 16 21.5 C15.5 18.5 14.7 16.5 11.5 16.5 C14.7 16.5 15.5 14.5 16 11.5 Z" fill={fg} />
    </svg>
  );
}
