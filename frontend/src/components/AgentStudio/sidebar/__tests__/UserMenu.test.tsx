import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../auth', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
    openLoginModal: vi.fn(),
  }),
}));

import UserMenu from '../UserMenu';

describe('UserMenu', () => {
  const defaultProps = {
    isUserMenuOpen: true,
    setIsUserMenuOpen: vi.fn(),
    setIsSettingsOpen: vi.fn(),
    setIsApiOpen: vi.fn(),
    onOpenWorkstation: vi.fn(),
  };

  it('renders menu items when open', () => {
    render(<UserMenu {...defaultProps} />);
    expect(screen.getByText('sidebar.workstation')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(<UserMenu {...defaultProps} isUserMenuOpen={false} />);
    expect(container.querySelector('.agentstudio-user-popover')).not.toBeInTheDocument();
  });
});
