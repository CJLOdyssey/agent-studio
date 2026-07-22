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
      className={`agentstudio-popover-item${disabled ? ' agentstudio-popover-item-disabled' : ''}`}
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
    <div className="agentstudio-sidebar-footer" ref={menuRef}>
      {isUserMenuOpen && (
        <div className="agentstudio-user-popover">
          <PopoverItem
            icon={<Key size={16} className="lucide-icon" />}
            label="API Key"
            onClick={() => handleItemClick(() => setIsApiOpen(true))}
          />
          <PopoverItem
            icon={<Settings size={16} className="lucide-icon" />}
            label={t('sidebar.settings')}
            onClick={() => handleItemClick(() => setIsSettingsOpen(true))}
          />
          <PopoverItem
            icon={isAuthenticated ? <LayoutDashboard size={16} className="lucide-icon" /> : <Lock size={16} className="lucide-icon" />}
            label={t('sidebar.workstation')}
            disabled={!isAuthenticated}
            onClick={() => handleItemClick(onOpenWorkstation)}
          />
          <PopoverItem
            icon={<HelpCircle size={16} className="lucide-icon" />}
            label={t('sidebar.help')}
            onClick={() => closeMenu()}
          />

          <div className="agentstudio-popover-divider" />
          {isAuthenticated ? (
            <PopoverItem
              icon={<LogOut size={16} className="lucide-icon" />}
              label={t('sidebar.logout')}
              onClick={() => handleItemClick(logout)}
            />
          ) : (
            <button
              className="agentstudio-popover-item agentstudio-popover-item-highlight"
              onClick={() => handleItemClick(() => openLoginModal())}
            >
              <LogIn size={16} className="lucide-icon" />
              <span>登录 / 注册</span>
            </button>
          )}
        </div>
      )}

      <button
        className="agentstudio-user-trigger"
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
          <div className="agentstudio-user-trigger-left">
            <div className="agentstudio-user-avatar">
              <User size={16} className="lucide-icon" />
            </div>
            <div className="agentstudio-user-info">
              <div className="agentstudio-user-name">
                {isAuthenticated ? (user?.username || user?.email) : '游客'}
              </div>
              <div className="agentstudio-user-status">
                <span className="agentstudio-user-online-dot" />
                {isAuthenticated ? t('user.onlineStatus') : '未登录'}
              </div>
            </div>
          </div>
      </button>
    </div>
  );
}
