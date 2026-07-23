import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import Modals from '../Modals';

describe('Modals', () => {
  it('renders without crashing', () => {
    const props = {
      isApiOpen: false, setIsApiOpen: vi.fn(),
      isSettingsOpen: false, setIsSettingsOpen: vi.fn(),
      isUserMenuOpen: false, setIsUserMenuOpen: vi.fn(),
    };
    render(<Modals {...props} />);
    expect(document.body).toBeDefined();
  });
});
