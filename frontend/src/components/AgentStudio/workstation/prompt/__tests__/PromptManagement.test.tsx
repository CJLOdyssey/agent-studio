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

import PromptManagement from '../PromptManagement';

function makePrompt(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'System Prompt', content: 'You are...', category: '系统提示词',
    model: 'GPT-4o', status: 'active' as const, version: 'v1.0.0', createdAt: '2024-01-01',
    ...overrides,
  };
}

describe('PromptManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll.mockResolvedValue([]);
  });

  it('renders empty state when no prompts', async () => {
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
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

  it('search input changes', async () => {
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { screen.getByRole('textbox'); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });
  });

  it('renders with category filter', async () => {
    mockFetchAll.mockResolvedValue([makePrompt()]);
    render(<PromptManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('System Prompt')).toBeInTheDocument(); });
  });
});
