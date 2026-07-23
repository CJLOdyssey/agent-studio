import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('./MonitorActivity', () => ({ default: () => null }));
vi.mock('./MonitorHealth', () => ({ default: () => null }));
vi.mock('./MonitorStats', () => ({ default: () => null }));

import MonitorCenter from '../MonitorCenter';

describe('MonitorCenter', () => {
  it('renders without crashing', () => {
    const { container } = render(<MonitorCenter onNavigate={vi.fn()} />);
    expect(container).toBeDefined();
  });
});
