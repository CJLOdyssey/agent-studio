import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VersionHistoryModal from '../VersionHistoryModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'workstation.versionHistory': '版本历史',
        'common.loading': '加载中...',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  GitCompare: () => <span>GitCompare</span>,
  Loader2: () => <span>Loader2</span>,
}));

const mockVersions = [
  {
    id: '1',
    version_num: 1,
    created_at: '2024-01-01T00:00:00Z',
    created_by: 'alice',
    snapshot: { content: 'hello world' },
  },
  {
    id: '2',
    version_num: 2,
    created_at: '2024-01-02T00:00:00Z',
    created_by: 'bob',
    snapshot: { content: 'hello world v2' },
  },
];

vi.mock('../../../../../api/client/versions', () => ({
  listVersions: vi.fn(() => Promise.resolve(mockVersions)),
}));

describe('VersionHistoryModal', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    render(
      <VersionHistoryModal title="Test" resourceType="prompt" resourceId="p1" onClose={vi.fn()} />,
    );
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders versions after loading', async () => {
    render(
      <VersionHistoryModal title="Test" resourceType="prompt" resourceId="p1" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
    });
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getAllByText(/hello world/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no versions returned', async () => {
    const mod = await vi.importMock<{ listVersions: ReturnType<typeof vi.fn> }>('../../../../../api/client/versions');
    mod.listVersions.mockResolvedValueOnce([]);

    render(
      <VersionHistoryModal title="Test" resourceType="prompt" resourceId="p1" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('暂无版本历史')).toBeInTheDocument();
    });
  });

  it('shows empty state on API error', async () => {
    const mod = await vi.importMock<{ listVersions: ReturnType<typeof vi.fn> }>('../../../../../api/client/versions');
    mod.listVersions.mockRejectedValueOnce(new Error('API error'));

    render(
      <VersionHistoryModal title="Test" resourceType="prompt" resourceId="p1" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('暂无版本历史')).toBeInTheDocument();
    });
  });

  it('enters compare mode when compare button clicked', async () => {
    render(
      <VersionHistoryModal title="Test" resourceType="prompt" resourceId="p1" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('版本对比'));
    expect(screen.getByText('退出对比')).toBeInTheDocument();
  });

  it('closes on overlay click', async () => {
    const onClose = vi.fn();
    render(
      <VersionHistoryModal title="Test" resourceType="prompt" resourceId="p1" onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
    });

    const overlay = document.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls listVersions on mount with correct params', async () => {
    render(
      <VersionHistoryModal title="Test" resourceType="skill" resourceId="sk1" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
    });
    const mod = await vi.importMock<{ listVersions: ReturnType<typeof vi.fn> }>('../../../../../api/client/versions');
    expect(mod.listVersions).toHaveBeenCalledWith('skill', 'sk1');
  });
});
