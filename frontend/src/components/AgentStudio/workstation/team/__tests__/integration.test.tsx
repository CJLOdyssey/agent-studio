import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';
import TeamManagement from '../TeamManagement';

type StoreTeam = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  category: 'dev' | 'ops' | 'test';
  createdAt: string;
  agents: unknown[];
  memberCount: number;
};

type TeamInput = {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive';
  category?: 'dev' | 'ops' | 'test';
};

const { STORE, mockAPI, resetStore } = vi.hoisted(() => {
  const STORE: StoreTeam[] = [];
  let _counter = 0;

  return {
    STORE,
    resetStore() { STORE.length = 0; _counter = 0; },
    mockAPI: {
      teamAPI: {
        fetchAll: vi.fn(async () => [...STORE]),
        create: vi.fn(async (data: TeamInput) => {
          const created: StoreTeam = {
            id: `new-${++_counter}`, name: data.name || '',
            description: data.description || '',
            status: data.status || 'active',
            category: data.category || 'dev',
            createdAt: new Date().toISOString().slice(0, 10),
            agents: [], memberCount: 0,
          };
          STORE.push(created);
          return created;
        }),
        update: vi.fn(async (id: string, data: TeamInput) => {
          const item = STORE.find(t => t.id === id);
          if (item) {
            if (data.name !== undefined) item.name = data.name;
            if (data.description !== undefined) item.description = data.description;
            if (data.status !== undefined) item.status = data.status;
            if (data.category !== undefined) item.category = data.category;
          }
        }),
        remove: vi.fn(async (id: string) => {
          const idx = STORE.findIndex(t => t.id === id);
          if (idx >= 0) STORE.splice(idx, 1);
        }),
        removeBatch: vi.fn(async (ids: Set<string>) => {
          for (const id of ids) {
            const idx = STORE.findIndex(t => t.id === id);
            if (idx >= 0) STORE.splice(idx, 1);
          }
        }),
        clone: vi.fn(async (item: StoreTeam) => {
          const created: StoreTeam = {
            ...item,
            id: `new-${++_counter}`,
            name: `${item.name} (副本)`,
          };
          STORE.push(created);
          return created;
        }),
      },
    },
  };
});

vi.mock('../api', () => mockAPI);

vi.mock('../locales', () => ({
  t: (k: string) => k,
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('Team Management Integration', { tags: ['integration'] }, () => {

  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('I-01: empty store shows empty state', async () => {
    render(<TeamManagement />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByText('team.empty_desc_general')).toBeInTheDocument();
    });
  });

  it('I-02: create team → row appears in table', async () => {
    STORE.push({ id: 't1', name: '前端组', description: '前端', status: 'active', category: 'dev', createdAt: '2026-01-01', agents: [], memberCount: 0 });
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => expect(screen.getByText('前端组')).toBeInTheDocument());

    fireEvent.click(screen.getByText('team.new'));

    const nameInput = screen.getByPlaceholderText('team.form_name_placeholder');
    fireEvent.change(nameInput, { target: { value: '新团队' } });

    fireEvent.click(screen.getByText('team.form_save_create'));

    await waitFor(() => {
      expect(screen.getByText('新团队')).toBeInTheDocument();
    });
  });

  it('I-03: category filter shows only matching rows', async () => {
    STORE.push(
      { id: 't1', name: '前端组', description: '', status: 'active', category: 'dev', createdAt: '2026-01-01', agents: [], memberCount: 0 },
      { id: 't2', name: '运维组', description: '', status: 'active', category: 'ops', createdAt: '2026-02-01', agents: [], memberCount: 0 },
    );
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => expect(screen.getByText('前端组')).toBeInTheDocument());

    fireEvent.mouseDown(document.querySelectorAll('.ant-select-selector')[0]);
    const matches = await screen.findAllByText('dev');
    const optContent = matches.find(el => el.closest('.ant-select-item-option'));
    const optItem = optContent?.closest('.ant-select-item-option');
    if (optItem) {
      fireEvent.mouseDown(optItem);
      fireEvent.click(optItem);
    }

    await waitFor(() => {
      expect(screen.getByText('前端组')).toBeInTheDocument();
      expect(screen.queryByText('运维组')).toBeNull();
    });
  });

  it('I-04: search filters by name keyword', async () => {
    STORE.push(
      { id: 't1', name: '前端开发组', description: '', status: 'active', category: 'dev', createdAt: '2026-01-01', agents: [], memberCount: 0 },
      { id: 't2', name: '测试团队', description: '', status: 'active', category: 'test', createdAt: '2026-03-01', agents: [], memberCount: 0 },
    );
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => expect(screen.getByText('前端开发组')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('team.search_placeholder');
    fireEvent.change(searchInput, { target: { value: '测试' } });

    await waitFor(() => {
      expect(screen.getByText('测试团队')).toBeInTheDocument();
      expect(screen.queryByText('前端开发组')).toBeNull();
    });
  });

  it('I-05: edit modal pre-fills and saves', async () => {
    STORE.push({ id: 't1', name: '待编辑组', description: '', status: 'active', category: 'dev', createdAt: '2026-01-01', agents: [], memberCount: 0 });
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => expect(screen.getByText('待编辑组')).toBeInTheDocument());

    const moreBtn = document.querySelector('tbody tr td:last-child button')!;
    fireEvent.click(moreBtn);

    await waitFor(() => {
      expect(screen.getByText('team.edit')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('team.edit'));

    await waitFor(() => {
      expect(screen.getByText('team.form_title_edit')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('team.form_name_placeholder');
    fireEvent.change(nameInput, { target: { value: '已重命名组' } });

    fireEvent.click(screen.getByText('team.form_save_edit'));

    await waitFor(() => {
      expect(screen.getByText('已重命名组')).toBeInTheDocument();
    });
  });

  it('I-06: delete removes row from table', async () => {
    STORE.push({ id: 't1', name: '待删除组', description: '', status: 'active', category: 'dev', createdAt: '2026-01-01', agents: [], memberCount: 0 });
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => expect(screen.getByText('待删除组')).toBeInTheDocument());

    const moreBtn = document.querySelector('tbody tr td:last-child button')!;
    fireEvent.click(moreBtn);

    await waitFor(() => {
      expect(screen.getByText('team.delete')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('team.delete'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'workstation.confirmDelete' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'workstation.confirmDelete' }));

    await waitFor(() => {
      expect(screen.queryByText('待删除组')).toBeNull();
    });
  });

  it('I-07: batch delete removes multiple rows', async () => {
    STORE.push(
      { id: 't1', name: '组A', description: '', status: 'active', category: 'dev', createdAt: '2026-01-01', agents: [], memberCount: 0 },
      { id: 't2', name: '组B', description: '', status: 'active', category: 'ops', createdAt: '2026-02-01', agents: [], memberCount: 0 },
    );
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => expect(screen.getByText('组A')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    await waitFor(() => {
      expect(screen.getByText('team.batch_delete')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('team.batch_delete'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'workstation.confirmDelete' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'workstation.confirmDelete' }));

    await waitFor(() => {
      expect(screen.queryByText('组A')).toBeNull();
      expect(screen.queryByText('组B')).toBeNull();
    });
  });

  it('I-08: pagination shows correct page data', async () => {
    for (let i = 0; i < 10; i++) {
      STORE.push({ id: `t${i}`, name: `团队${i}`, description: '', status: 'active', category: 'dev', createdAt: '2026-01-01', agents: [], memberCount: 0 });
    }
    render(<TeamManagement />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByText('团队0')).toBeInTheDocument();
    });
    expect(screen.queryByText('团队9')).toBeNull();

    fireEvent.click(screen.getByText('2'));

    await waitFor(() => {
      expect(screen.getByText('团队9')).toBeInTheDocument();
    });
    expect(screen.queryByText('团队0')).toBeNull();
  });
});
