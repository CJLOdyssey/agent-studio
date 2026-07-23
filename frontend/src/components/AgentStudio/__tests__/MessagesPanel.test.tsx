import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('./TeamMessage', () => ({ default: () => null }));
vi.mock('./GreetingAnimation', () => ({ default: () => null }));
vi.mock('../stores/chatStore', () => ({
  useChatStore: (s?: any) => {
    const state = { messages: [], isRunning: false, status: 'idle', error: null };
    return s ? s(state) : state;
  },
}));

import MessagesPanel from '../MessagesPanel';

const baseProps = {
  activeConvId: null, onRunSubmit: vi.fn(), onRunRetry: vi.fn(),
  onRunCancel: vi.fn(),
};

describe('MessagesPanel', () => {
  it('renders empty state', () => {
    const { container } = render(<MessagesPanel {...baseProps} />);
    expect(container).toBeDefined();
  });
});
