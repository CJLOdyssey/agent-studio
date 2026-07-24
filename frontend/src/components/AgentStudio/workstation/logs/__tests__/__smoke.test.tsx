import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LogAudit } from '../index';

vi.mock('../../../../../api/client/admin', () => ({
  fetchCommandLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock('../locales', () => ({
  t: (k: string) => k,
  setLang: vi.fn(),
  getLang: () => 'en',
}));

describe('LogAudit (index export)', { tags: ['integration'] }, () => {
  it('module exports the component', async () => {
    const mod = await import('../index');
    expect(mod.LogAudit).toBeDefined();
  });

  it('renders LogAudit wrapped in ErrorBoundary', async () => {
    render(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText('logs.empty')).toBeInTheDocument();
  });
});
