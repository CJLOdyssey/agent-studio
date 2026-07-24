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

function advanceTimersSequentially(ms: number): void {
  for (let i = 0; i < ms; i += 100) {
    act(() => { vi.advanceTimersByTime(100); });
  }
}

describe('GreetingAnimation', { tags: ['integration'] }, () => {
  it('renders typing cursor initially', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    expect(screen.getByText('|')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders greeting text after timers advance', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    advanceTimersSequentially(600);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders partial text after partial advance', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    advanceTimersSequentially(200);
    const h1 = screen.getByRole('heading');
    expect(h1.textContent).toContain('He');
    const partialText = screen.getByText(/^He/);
    expect(partialText).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('continues to show cursor while animation is incomplete', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    advanceTimersSequentially(300);
    expect(screen.getByText('|')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('removes cursor when animation completes', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    // "Hello" is 5 chars, needs 500ms + 100ms for the final setState
    advanceTimersSequentially(600);
    expect(screen.queryByText('|')).toBeNull();
    vi.useRealTimers();
  });

  it('shows full greeting text after complete', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    advanceTimersSequentially(600);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders heading with correct class', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    const h1 = screen.getByRole('heading');
    expect(h1.className).toBe('agentstudio-home-greeting');
    vi.useRealTimers();
  });

  it('cleans up timer on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<GreetingAnimation />);
    advanceTimersSequentially(200);
    unmount();
    // Advance further — no state updates should cause issues after unmount
    advanceTimersSequentially(500);
    vi.useRealTimers();
  });

  it('updates progressively with each timer tick', () => {
    vi.useFakeTimers();
    render(<GreetingAnimation />);
    const h1 = screen.getByRole('heading');
    // 0ms — cursor, but no text yet
    // 100ms — "H"
    advanceTimersSequentially(100);
    expect(h1.textContent).toContain('H');
    // 400ms — "Hello" (5 chars)
    advanceTimersSequentially(400);
    expect(h1.textContent).toContain('Hello');
    vi.useRealTimers();
  });
});
