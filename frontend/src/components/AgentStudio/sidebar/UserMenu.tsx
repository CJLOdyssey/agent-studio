import { useRef, useEffect, useCallback } from 'react';
import { Settings, Key, HelpCircle, LogOut, User, LayoutDashboard, LogIn, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth';

interface Props {
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: (v: boolean) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsApiOpen: (v: boolean) => void;
  onOpenWorkstation: () => void;
}

function PopoverItem({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none rounded-md text-[var(--color-text-secondary)] text-sm cursor-pointer transition-all duration-200 text-left hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]${disabled ? ' opacity-40 cursor-not-allowed hover:text-[var(--color-text-secondary)] hover:bg-transparent' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? '登录后可管理' : undefined}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function UserMenu({ isUserMenuOpen, setIsUserMenuOpen, setIsSettingsOpen, setIsApiOpen, onOpenWorkstation }: Props) {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout, openLoginModal } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsUserMenuOpen(false), [setIsUserMenuOpen]);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isUserMenuOpen, closeMenu]);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isUserMenuOpen, closeMenu]);

  const handleItemClick = (action: () => void) => {
    closeMenu();
    action();
  };

  return (
    <div className="shrink-0 p-3 bg-[var(--color-surface-sidebar)] relative" ref={menuRef}>
      {isUserMenuOpen && (
        <div className="absolute bottom-[calc(100%+8px)] left-3 right-3 bg-[var(--color-surface-card)] border-none rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.18)] z-[var(--z-modal)] flex flex-col p-1 origin-bottom animate-[popoverScaleIn_0.15s_cubic-bezier(0.16,1,0.3,1)]">
          <PopoverItem
            icon={<Key size={16} className="w-4 h-4 mr-1" />}
            label="API Key"
            onClick={() => handleItemClick(() => setIsApiOpen(true))}
          />
          <PopoverItem
            icon={<Settings size={16} className="w-4 h-4 mr-1" />}
            label={t('sidebar.settings')}
            onClick={() => handleItemClick(() => setIsSettingsOpen(true))}
          />
          <PopoverItem
            icon={isAuthenticated ? <LayoutDashboard size={16} className="w-4 h-4 mr-1" /> : <Lock size={16} className="w-4 h-4 mr-1" />}
            label={t('sidebar.workstation')}
            disabled={!isAuthenticated}
            onClick={() => handleItemClick(onOpenWorkstation)}
          />
          <PopoverItem
            icon={<HelpCircle size={16} className="w-4 h-4 mr-1" />}
            label={t('sidebar.help')}
            onClick={() => closeMenu()}
          />

          <div className="h-px bg-[var(--color-border-subtle)] my-1" />
          {isAuthenticated ? (
            <PopoverItem
              icon={<LogOut size={16} className="w-4 h-4 mr-1" />}
              label={t('sidebar.logout')}
              onClick={() => handleItemClick(logout)}
            />
          ) : (
            <button
              className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none rounded-md text-[var(--color-accent)] font-semibold text-sm cursor-pointer transition-all duration-200 text-left border-b border-b-[var(--color-border)] mb-1 rounded-0 hover:text-[var(--color-accent-hover)] hover:bg-[var(--color-surface-hover)]"
              onClick={() => handleItemClick(() => openLoginModal())}
            >
              <LogIn size={16} className="w-4 h-4 mr-1" />
              <span>登录 / 注册</span>
            </button>
          )}
        </div>
      )}

      <button
        className="flex items-center justify-between w-full p-2 bg-transparent border border-transparent rounded-lg text-[var(--color-text-primary)] cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)]"
        onClick={() => {
          if (isUserMenuOpen) {
            closeMenu();
          } else {
            setIsUserMenuOpen(true);
          }
        }}
        aria-expanded={isUserMenuOpen}
        aria-haspopup="menu"
      >
          <div className="flex items-center gap-[10px] overflow-hidden">
            <div className="w-8 h-8 bg-[var(--color-surface)] rounded-full border-none flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <User size={16} className="w-4 h-4 text-[var(--color-text-secondary)]" />
            </div>
            <div className="overflow-hidden text-left">
              <div className="text-[var(--da-font-size-sm)] font-semibold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis">
                {isAuthenticated ? (user?.username || user?.email) : '游客'}
              </div>
              <div className="text-[var(--da-font-size-xs)] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                {isAuthenticated ? t('user.onlineStatus') : '未登录'}
              </div>
            </div>
          </div>
      </button>
    </div>
  );
}
