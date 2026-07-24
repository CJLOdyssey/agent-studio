import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'api.usageStats': 'Usage Statistics',
        'api.todayRequests': 'Today Requests',
        'api.todayTokens': 'Today Tokens',
        'api.monthRequests': 'Month Requests',
        'api.monthTokens': 'Month Tokens',
      };
      return map[key] || key;
    },
  }),
}));

import ApiUsageTab from '../ApiUsageTab';

describe('ApiUsageTab', { tags: ['integration'] }, () => {
  it('renders usage statistics', () => {
    render(
      <ApiUsageTab usage={{ today_requests: 10, today_tokens: 500, month_requests: 200, month_tokens: 10000 }} />,
    );
    expect(screen.getByText('Usage Statistics')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });

  it('renders with zero values', () => {
    render(
      <ApiUsageTab usage={{ today_requests: 0, today_tokens: 0, month_requests: 0, month_tokens: 0 }} />,
    );
    expect(screen.getByText('Usage Statistics')).toBeInTheDocument();
    expect(screen.getByText('Today Requests')).toBeInTheDocument();
  });
});
