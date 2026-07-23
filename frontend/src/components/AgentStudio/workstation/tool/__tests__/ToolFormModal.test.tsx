import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { EMPTY_FORM } from '../validate';
import ToolFormModal from '../ToolFormModal';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

describe('ToolFormModal', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ToolFormModal formData={EMPTY_FORM} setFormData={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} errors={[]} />,
      { wrapper: Wrapper }
    );
    expect(container).toBeDefined();
  });
});
