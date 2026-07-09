import { useRef, useEffect, useCallback } from 'react';
import { Settings, Key, HelpCircle, LogOut, ChevronsUpDown, User, LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: (v: boolean) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsApiOpen: (v: boolean) => void;
  onOpenWorkstation: () => void;
}

export default function UserMenu({ isUserMenuOpen, setIsUserMenuOpen, setIsSettingsOpen, setIsApiOpen, onOpenWorkstation }: Props) {
  const { t } = useTranslation();
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
      {/* 用户菜单 Popover */}
      {isUserMenuOpen && (
        <div className="agentstudio-user-popover">
          <button
            className="agentstudio-popover-item"
            onClick={() => handleItemClick(() => setIsSettingsOpen(true))}
          >
            <Settings size={16} className="lucide-icon" />
            <span>{t('sidebar.settings')}</span>
          </button>
          <button
            className="agentstudio-popover-item"
            onClick={() => handleItemClick(() => setIsApiOpen(true))}
          >
            <Key size={16} className="lucide-icon" />
            <span>API Key</span>
          </button>
          <button
            className="agentstudio-popover-item"
            onClick={() => handleItemClick(onOpenWorkstation)}
          >
            <LayoutDashboard size={16} className="lucide-icon" />
            <span>管理工作台</span>
          </button>
          <button className="agentstudio-popover-item" onClick={() => closeMenu()}>
            <HelpCircle size={16} className="lucide-icon" />
            <span>{t('sidebar.help')}</span>
          </button>

          <div className="agentstudio-popover-divider" />
          <button className="agentstudio-popover-item danger" onClick={() => closeMenu()}>
            <LogOut size={16} className="lucide-icon" />
            <span>{t('sidebar.logout')}</span>
          </button>
        </div>
      )}

      {/* 用户触发器按钮 */}
      <button
        className="agentstudio-user-trigger"
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        aria-expanded={isUserMenuOpen}
        aria-haspopup="menu"
      >
        <div className="agentstudio-user-trigger-left">
          <div className="agentstudio-user-avatar">
            <User size={16} className="lucide-icon" />
          </div>
          <div className="agentstudio-user-info">
            <div className="agentstudio-user-name">User 1001</div>
            <div className="agentstudio-user-status">
              <span className="agentstudio-user-online-dot" />
              在线状态
            </div>
          </div>
        </div>
        <ChevronsUpDown size={16} className="agentstudio-user-trigger-icon" />
      </button>
    </div>
  );
}
