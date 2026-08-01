import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

const { mockFetchAll, mockCreate, mockUpdate, mockRemove, mockClone, mockRemoveBatch, mockBatchAdd, mockImport } = vi.hoisted(() => ({
  mockFetchAll: vi.fn().mockResolvedValue([]),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockRemove: vi.fn(),
  mockClone: vi.fn(),
  mockRemoveBatch: vi.fn(),
  mockBatchAdd: vi.fn(),
  mockImport: vi.fn().mockResolvedValue({
    id: 'imported-1', name: 'imported-skill', description: 'desc', category: '导入',
    status: 'active', version: 'v1.0.0', author: '', instructions: 'body text',
    tool_names: ['execute_python'], output_constraint: '',
    created_at: '2024-01-01T00:00:00Z',
  }),
}));

vi.mock('../../../../../api/client/skills', () => ({
  importSkillFromMarkdown: (...args: unknown[]) => mockImport(...args),
}));

vi.mock('../api', () => ({
  skillAPI: {
    fetchAll: mockFetchAll, create: mockCreate, update: mockUpdate, remove: mockRemove,
    clone: mockClone, removeBatch: mockRemoveBatch, batchAdd: mockBatchAdd,
  },
}));

import SkillManagement from '../SkillManagement';

function makeSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'React Skill', description: 'React coding skill', category: '前端开发',
    status: 'installed' as const, version: 'v1.0.0', author: 'Alice', instructions: 'Do stuff',
    tool_names: [], output_constraint: '', createdAt: '2024-01-01',
    ...overrides,
  };
}

describe('SkillManagement', { tags: ['unit'] }, () => {
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
    const statusElements = screen.getAllByRole('status');
    expect(statusElements.length).toBeGreaterThanOrEqual(1);
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

  it('imports a SKILL.md and shows the imported skill', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<SkillManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('导入 SKILL.md')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('导入 SKILL.md'));
    // Modal 默认在「上传」tab，切到「粘贴」tab 找到 textarea
    const pasteTab = await waitFor(() => {
      const el = screen.getAllByRole('tab').find((t) => t.textContent?.includes('粘贴') || t.textContent?.includes('paste'));
      if (!el) throw new Error('paste tab not found');
      return el as Element;
    });
    fireEvent.click(pasteTab);
    const textarea = await screen.findByPlaceholderText(/name: my-skill/);
    fireEvent.change(textarea, { target: { value: '---\nname: imported-skill\n---\n\nbody' } });
    const okButton = await waitFor(() => {
      const el = document.querySelector('.ant-modal-footer .ant-btn-primary');
      if (!el) throw new Error('ok button not found');
      return el as Element;
    });
    fireEvent.click(okButton);
    await waitFor(() => {
      expect(mockImport).toHaveBeenCalledWith('---\nname: imported-skill\n---\n\nbody');
    });
    await waitFor(() => {
      expect(screen.getByText('imported-skill')).toBeInTheDocument();
    });
  });
});
