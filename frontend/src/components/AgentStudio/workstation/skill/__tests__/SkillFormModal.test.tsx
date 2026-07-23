import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../locales', () => ({ t: (k: string) => k }));
vi.mock('../../../api/client/models', () => ({ listModels: () => Promise.resolve([]) }));
vi.mock('../../shared/ResourcePickerModal', () => ({ default: () => null }));

import SkillFormModal from '../SkillFormModal';

const mockFormData = {
  name: '', description: '', category: 'AI/ML', status: 'available' as const,
  version: 'v1.0.0', author: '', instructions: '', prompt_id: '',
  tool_names: [] as string[], output_constraint: '',
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

describe('SkillFormModal', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <SkillFormModal editingSkill={null} formData={mockFormData} setFormData={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} errors={[]} />,
      { wrapper: Wrapper }
    );
    expect(container).toBeDefined();
  });
});
