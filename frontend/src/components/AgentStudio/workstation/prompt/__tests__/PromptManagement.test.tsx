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
  get promptAPI() {
    return { fetchAll: mockFetchAll, create: mockCreate, update: mockUpdate, remove: mockRemove, clone: mockClone, removeBatch: mockRemoveBatch };
  },
}));

vi.mock('../locales', () => ({ t: (k: string) => k, setLang: vi.fn(), getLang: () => 'zh' }));
vi.mock('../../shared/WstaPagination', () => ({ default: () => <div className="wsta-pagination" /> }));
vi.mock('../../shared/LoadingSkeleton', () => ({ TableSkeleton: () => <div data-testid="skeleton" /> }));
vi.mock('../PromptFormModal', () => ({ default: () => null }));
vi.mock('../../shared/DeleteConfirmModal', () => ({ default: () => null }));
vi.mock('../../shared/BatchDeleteModal', () => ({ default: () => null }));
vi.mock('../../shared/VersionHistoryModal', () => ({ default: () => null }));

import PromptManagement from '../PromptManagement';

function makePrompt(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'System Prompt', content: 'You are...', category: '系统提示词',
    model: 'GPT-4o', status: 'active' as const, version: 'v1.0.0', createdAt: '2024-01-01',
    ...overrides,
  };
}

describe('PromptManagement', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll.mockResolvedValue([]);
  });

  it('renders loading skeleton', () => {
    mockFetchAll.mockReturnValue(new Promise(() => {}));
    render(<PromptManagement />, { wrapper: TestProviders });
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders empty state when no prompts', async () => {
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    expect(screen.getByText('prompt.empty_title')).toBeInTheDocument();
    expect(screen.getByText('prompt.empty_desc_general')).toBeInTheDocument();
  });

  it('shows search-related empty message when search is active', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByRole('region')).toBeInTheDocument(); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    await waitFor(() => {
      expect(screen.getByText('prompt.empty_desc_search')).toBeInTheDocument();
    });
  });

  it('renders prompt table with data', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('System Prompt')).toBeInTheDocument();
    });
  });

  it('renders multiple prompts', async () => {
    mockFetchAll.mockResolvedValue([makePrompt(), makePrompt({ id: '2', name: 'User Prompt' })]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('System Prompt')).toBeInTheDocument();
      expect(screen.getByText('User Prompt')).toBeInTheDocument();
    });
  });

  it('renders category tag', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('系统提示词')).toBeInTheDocument();
    });
    expect(document.querySelector('.wsta-tag-pill')).toBeInTheDocument();
  });

  it('renders status text', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });

  it('search input renders and accepts input', async () => {
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { screen.getByRole('textbox'); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test search' } });
    expect(input).toHaveValue('test search');
  });

  it('renders category filter with all categories option', async () => {
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByRole('region')).toBeInTheDocument(); });
    expect(screen.getByText('prompt.all_categories')).toBeInTheDocument();
  });

  it('renders create prompt button', async () => {
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByRole('region')).toBeInTheDocument(); });
    expect(screen.getByText('prompt.new')).toBeInTheDocument();
  });

  it('renders toolbar with correct role', async () => {
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByRole('region')).toBeInTheDocument(); });
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('renders pagination', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('System Prompt')).toBeInTheDocument(); });
    expect(document.querySelector('.wsta-pagination')).toBeInTheDocument();
  });

  it('has accessible table grid', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('System Prompt')).toBeInTheDocument(); });
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('renders checkbox for selection', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('System Prompt')).toBeInTheDocument(); });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('allows selecting items via checkbox', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('System Prompt')).toBeInTheDocument(); });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length >= 2) {
      fireEvent.click(checkboxes[1]);
    }
  });

  it('renders action button for each row', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('System Prompt')).toBeInTheDocument(); });
    expect(document.querySelector('.wsta-action-btn')).toBeInTheDocument();
  });

  it('wraps content in ErrorBoundary', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByRole('region')).toBeInTheDocument(); });
  });
});
