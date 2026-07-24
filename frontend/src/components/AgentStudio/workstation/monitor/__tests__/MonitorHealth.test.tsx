import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonitorHealth from '../MonitorHealth';

vi.mock('../locales', () => ({ t: (k: string) => k }));

describe('MonitorHealth', { tags: ['integration'] }, () => {
  it('renders health section title', () => {
    const items = [
      { label: 'CPU', value: '45%', status: 'normal' as const },
      { label: 'Memory', value: '3.2/8 GB', status: 'normal' as const },
      { label: 'Disk', value: '85%', status: 'warning' as const },
    ];
    render(<MonitorHealth items={items} />);
    expect(screen.getByText('monitor.health')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('3.2/8 GB')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });
});
