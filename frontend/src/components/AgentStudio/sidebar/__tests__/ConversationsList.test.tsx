import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));

import ConversationsList from '../ConversationsList';
import type { Conversation } from '../../../../types/AgentStudio';

describe('ConversationsList', () => {
  const baseProps = {
    conversations: [] as Conversation[],
    activeConvId: null,
    selectedAgentId: null,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders empty state', () => {
    const { container } = render(
      <VirtuosoMockContext.Provider value={{ viewportHeight: 300, itemHeight: 50 }}>
        <ConversationsList {...baseProps} />
      </VirtuosoMockContext.Provider>
    );
    expect(container).toBeDefined();
  });

  it('renders conversation items', () => {
    const conversations = [
      { id: 'c1', title: 'Chat 1', updatedAt: new Date().toISOString(), messages: [] },
    ] as Conversation[];
    const { container } = render(
      <VirtuosoMockContext.Provider value={{ viewportHeight: 300, itemHeight: 50 }}>
        <ConversationsList {...baseProps} conversations={conversations} />
      </VirtuosoMockContext.Provider>
    );
    expect(container.textContent).toContain('Chat 1');
  });
});
