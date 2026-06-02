import { useRef, useEffect, useCallback } from 'react';
import { UserCircle, Settings, Key, HelpCircle, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: (v: boolean) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsApiOpen: (v: boolean) => void;
}

export default function UserMenu({ isUserMenuOpen, setIsUserMenuOpen, setIsSettingsOpen, setIsApiOpen }: Props) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setIsUserMenuOpen(false), [setIsUserMenuOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isUserMenuOpen, closeMenu]);

  // Close on click outside
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
    <div className="devagents-sidebar-footer">
      <div className="devagents-user-menu" ref={menuRef}>
        <button
          className="devagents-user-btn"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          aria-expanded={isUserMenuOpen}
          aria-haspopup="menu"
          aria-label={t('sidebar.settings')}
          ref={triggerRef}
        >
          <div className="devagents-user-avatar"><UserCircle size={20} /></div>
          <span className="devagents-user-id">User 1001</span>
        </button>
        {isUserMenuOpen && (
          <div className="devagents-user-dropdown" role="menu" aria-label={t('sidebar.settings')}>
            <button
              className="devagents-dropdown-item"
              role="menuitem"
              tabIndex={0}
              onClick={() => handleItemClick(() => setIsSettingsOpen(true))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick(() => setIsSettingsOpen(true)); } }}
            >
              <Settings size={16} /><span>{t('sidebar.settings')}</span>
            </button>
            <button
              className="devagents-dropdown-item"
              role="menuitem"
              tabIndex={0}
              onClick={() => handleItemClick(() => setIsApiOpen(true))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick(() => setIsApiOpen(true)); } }}
            >
              <Key size={16} /><span>{t('api.manage')}</span>
            </button>
            <button
              className="devagents-dropdown-item"
              role="menuitem"
              tabIndex={0}
              onClick={() => closeMenu()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeMenu(); } }}
            >
              <HelpCircle size={16} /><span>{t('sidebar.help')}</span>
            </button>
            <div className="devagents-dropdown-divider" role="separator"></div>
            <button
              className="devagents-dropdown-item danger"
              role="menuitem"
              tabIndex={0}
              onClick={() => closeMenu()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeMenu(); } }}
            >
              <LogOut size={16} /><span>{t('sidebar.logout')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
