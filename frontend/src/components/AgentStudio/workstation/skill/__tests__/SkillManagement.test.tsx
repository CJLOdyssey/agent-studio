import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

const mockFetchAll = vi.fn().mockResolvedValue([]);
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockClone = vi.fn();
const mockRemoveBatch = vi.fn();

vi.mock('../api', () => ({
  get skillAPI() {
    return { fetchAll: mockFetchAll, create: mockCreate, update: mockUpdate, remove: mockRemove, clone: mockClone, removeBatch: mockRemoveBatch };
  },
}));

import SkillManagement from '../SkillManagement';

function makeSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'React Skill', description: 'React coding skill', category: '前端开发',
    status: 'installed' as const, version: 'v1.0.0', author: 'Alice', instructions: 'Do stuff',
    prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2024-01-01',
    ...overrides,
  };
}

describe('SkillManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll.mockResolvedValue([]);
  });

  it('renders empty state when no skills', async () => {
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('renders skill table with data', async () => {
    mockFetchAll.mockResolvedValue([makeSkill()]);
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('React Skill')).toBeInTheDocument();
    });
  });

  it('renders multiple skills', async () => {
    mockFetchAll.mockResolvedValue([makeSkill(), makeSkill({ id: '2', name: 'Python Skill' })]);
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('React Skill')).toBeInTheDocument();
      expect(screen.getByText('Python Skill')).toBeInTheDocument();
    });
  });

  it('search input changes', async () => {
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => { screen.getByRole('textbox'); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'react' } });
  });

  it('renders with available status skill', async () => {
    mockFetchAll.mockResolvedValue([makeSkill({ status: 'available' })]);
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('React Skill')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while fetching', () => {
    mockFetchAll.mockReturnValue(new Promise(() => {}));
    const { container } = render(<SkillManagement />, { wrapper: TestProviders });
    expect(container.querySelector('.wsta-agent-mgmt')).toBeInTheDocument();
  });

  it('selects a row checkbox', async () => {
    mockFetchAll.mockResolvedValue([makeSkill(), makeSkill({ id: '2', name: 'Python Skill' })]);
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('React Skill')).toBeInTheDocument(); });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(checkboxes[1]);
  });

  it('renders installed status badge', async () => {
    mockFetchAll.mockResolvedValue([makeSkill()]);
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('已安装')).toBeInTheDocument();
    });
  });

  it('renders category badge', async () => {
    mockFetchAll.mockResolvedValue([makeSkill()]);
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('前端开发')).toBeInTheDocument();
    });
  });
});
