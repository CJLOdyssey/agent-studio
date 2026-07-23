import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../locales', () => ({ t: (k: string) => k }));
vi.mock('../../../../api/client/teams', () => ({ listTeams: () => Promise.resolve([]) }));
vi.mock('./ResourcePickerSection', () => ({ ResourcePickerSection: () => null }));
vi.mock('../../shared/ResourcePickerModal', () => ({ default: () => null }));

import AgentFormModal from '../AgentFormModal';
import type { AgentFormData } from '../agent.types';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

const baseProps = {
  editingAgent: null,
  formData: { name: '', version: 'v1.0.0', systemPromptId: '' } as AgentFormData,
  setFormData: vi.fn(), formErrors: [],
  onSave: vi.fn(), onClose: vi.fn(),
  availablePrompts: [], availableTools: [], availableMCPs: [], availableSkills: [],
};

describe('AgentFormModal', () => {
  it('renders create mode', () => {
    const { container } = render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });
});
