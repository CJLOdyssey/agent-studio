import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PromptEntry, PromptFormData } from '../types';

const mockListPrompts = vi.fn();
const mockCreatePrompt = vi.fn();
const mockUpdatePrompt = vi.fn();
const mockDeletePrompt = vi.fn();

vi.mock('../../../../../api/client/prompts', () => ({
  listPrompts: mockListPrompts,
  createPrompt: mockCreatePrompt,
  updatePrompt: mockUpdatePrompt,
  deletePrompt: mockDeletePrompt,
}));

describe('prompt api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const sampleRow = {
    id: 'p1',
    name: 'Prompt 1',
    category: 'system',
    content: 'You are helpful',
    model: 'gpt-4',
    status: 'active',
    version: 'v1',
    created_at: '2024-01-15T00:00:00Z',
  };

  it('fetchAll returns mapped entries', async () => {
    mockListPrompts.mockResolvedValue([sampleRow]);

    const { promptAPI } = await import('../api');
    const result = await promptAPI.fetchAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Prompt 1');
    expect(result[0].category).toBe('system');
  });

  it('create calls createPrompt and returns entry', async () => {
    mockCreatePrompt.mockResolvedValue(sampleRow);

    const { promptAPI } = await import('../api');
    const data: PromptFormData = { name: 'New', category: 'system', content: 'Hello' };
    const result = await promptAPI.create(data);

    expect(mockCreatePrompt).toHaveBeenCalledWith({
      name: 'New',
      category: 'system',
      content: 'Hello',
    });
    expect(result.name).toBe('Prompt 1');
  });

  it('update calls updatePrompt', async () => {
    mockUpdatePrompt.mockResolvedValue(undefined);

    const { promptAPI } = await import('../api');
    await promptAPI.update('p1', { name: 'Updated' });

    expect(mockUpdatePrompt).toHaveBeenCalledWith('p1', { name: 'Updated' });
  });

  it('remove calls deletePrompt', async () => {
    mockDeletePrompt.mockResolvedValue(undefined);

    const { promptAPI } = await import('../api');
    await promptAPI.remove('p1');

    expect(mockDeletePrompt).toHaveBeenCalledWith('p1');
  });

  it('clone creates a copy', async () => {
    mockCreatePrompt.mockResolvedValue({ ...sampleRow, name: 'Original (副本)' });

    const { promptAPI } = await import('../api');
    const item: PromptEntry = {
      id: 'p1',
      name: 'Original',
      content: 'content',
      category: 'system',
      model: 'gpt-4',
      status: 'active',
      version: 'v1',
      createdAt: '2024-01-01',
    };
    await promptAPI.clone(item);

    expect(mockCreatePrompt).toHaveBeenCalledWith({
      name: 'Original (副本)',
      category: 'system',
      content: 'content',
    });
  });

  it('removeBatch deletes multiple', async () => {
    mockDeletePrompt.mockResolvedValue(undefined);

    const { promptAPI } = await import('../api');
    await promptAPI.removeBatch(new Set(['p1', 'p2']));

    expect(mockDeletePrompt).toHaveBeenCalledTimes(2);
  });

  it('toEntry maps status correctly', async () => {
    mockListPrompts.mockResolvedValue([{ ...sampleRow, status: 'draft', model: null }]);

    const { promptAPI } = await import('../api');
    const result = await promptAPI.fetchAll();

    expect(result[0].status).toBe('draft');
    expect(result[0].model).toBe('');
  });
});
