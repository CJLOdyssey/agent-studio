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
  return (
    <div className="devagents-sidebar-footer">
      <div className="devagents-user-menu">
        <button className="devagents-user-btn" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
          <div className="devagents-user-avatar"><UserCircle size={20} /></div>
          <span className="devagents-user-id">User 1001</span>
        </button>
        {isUserMenuOpen && (
          <div className="devagents-user-dropdown">
            <button className="devagents-dropdown-item" onClick={() => { setIsUserMenuOpen(false); setIsSettingsOpen(true); }}>
              <Settings size={16} /><span>{t('sidebar.settings')}</span>
            </button>
            <button className="devagents-dropdown-item" onClick={() => { setIsUserMenuOpen(false); setIsApiOpen(true); }}>
              <Key size={16} /><span>{t('api.manage')}</span>
            </button>
            <button className="devagents-dropdown-item" onClick={() => setIsUserMenuOpen(false)}>
              <HelpCircle size={16} /><span>{t('sidebar.help')}</span>
            </button>
            <div className="devagents-dropdown-divider"></div>
            <button className="devagents-dropdown-item danger" onClick={() => setIsUserMenuOpen(false)}>
              <LogOut size={16} /><span>{t('sidebar.logout')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
