import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../../stores/chatStore', () => ({
  useChatStore: (s?: any) => {
    const state = { activeConvId: null, messages: [] };
    return s ? s(state) : state;
  },
}));
vi.mock('./WorkflowEditor', () => ({ default: () => null }));
vi.mock('./WorkflowManagement', () => ({ default: () => null }));

import Workspace from '../Workspace';

describe('Workspace', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Workspace
        selectedAgentId={null} onRunSubmit={vi.fn()} onRunRetry={vi.fn()} onRunCancel={vi.fn()}
      />
    );
    expect(container).toBeDefined();
  });
});
