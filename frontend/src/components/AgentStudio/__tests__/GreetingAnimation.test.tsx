import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'home.greeting') return 'Hello';
      return key;
    },
  }),
}));

import GreetingAnimation from '../GreetingAnimation';

describe('GreetingAnimation', () => {
  it('renders typing cursor initially', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    expect(screen.getByText('|')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders greeting text after timers advance', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText('Hello')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
