import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OutputEntry, OutputFormData } from '../output.types';

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

describe('output api', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const sampleRow = {
    id: 'p1',
    name: 'Output 1',
    content: 'be concise',
    category: 'output_constraint',
    model: 'visual',
    status: 'active',
    version: 'v1',
    created_at: '2024-01-15T00:00:00Z',
  };

  it('fetchAll returns mapped entries', async () => {
    mockListPrompts.mockResolvedValue([sampleRow]);

    const { outputAPI } = await import('../api');
    const result = await outputAPI.fetchAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Output 1');
    expect(result[0].content).toBe('be concise');
    expect(result[0].status).toBe('active');
    expect(result[0].category).toBe('output_constraint');
  });

  it('fetchAll filters to output_constraint category', async () => {
    mockListPrompts.mockResolvedValue([
      { ...sampleRow, category: 'other' },
      { ...sampleRow, id: 'p2', category: 'output_constraint' },
    ]);

    const { outputAPI } = await import('../api');
    const result = await outputAPI.fetchAll();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2');
  });

  it('fetchAll does not read category from the model field', async () => {
    mockListPrompts.mockResolvedValue([{ ...sampleRow, model: 'visual' }]);

    const { outputAPI } = await import('../api');
    const result = await outputAPI.fetchAll();

    expect(result[0].category).toBe('output_constraint');
    expect(result[0].category).not.toBe('visual');
  });

  it('fetchAll defaults status to active when DB value is empty', async () => {
    mockListPrompts.mockResolvedValue([{ ...sampleRow, status: '' }]);

    const { outputAPI } = await import('../api');
    const result = await outputAPI.fetchAll();

    expect(result[0].status).toBe('active');
  });

  it('fetchAll maps status from the prompts table', async () => {
    mockListPrompts.mockResolvedValue([{ ...sampleRow, status: 'draft' }]);

    const { outputAPI } = await import('../api');
    const result = await outputAPI.fetchAll();

    expect(result[0].status).toBe('draft');
  });

  it('create calls createPrompt with category=output_constraint and status, never model', async () => {
    mockCreatePrompt.mockResolvedValue(sampleRow);

    const { outputAPI } = await import('../api');
    const data: OutputFormData = { name: 'New Output', content: 'content', category: 'output_constraint', status: 'draft' };
    const result = await outputAPI.create(data);

    expect(mockCreatePrompt).toHaveBeenCalledWith({
      name: 'New Output',
      category: 'output_constraint',
      content: 'content',
      status: 'draft',
    });
    expect(mockCreatePrompt).not.toHaveBeenCalledWith(expect.objectContaining({ model: expect.anything() }));
    expect(result.name).toBe('Output 1');
  });

  it('update calls updatePrompt with provided fields', async () => {
    mockUpdatePrompt.mockResolvedValue(undefined);

    const { outputAPI } = await import('../api');
    await outputAPI.update('p1', { name: 'Updated', content: 'new content' });

    expect(mockUpdatePrompt).toHaveBeenCalledWith('p1', {
      name: 'Updated',
      content: 'new content',
    });
  });

  it('update maps status to the prompts status field', async () => {
    mockUpdatePrompt.mockResolvedValue(undefined);

    const { outputAPI } = await import('../api');
    await outputAPI.update('p1', { status: 'archived' });

    expect(mockUpdatePrompt).toHaveBeenCalledWith('p1', { status: 'archived' });
  });

  it('update no longer sends category into the model field', async () => {
    mockUpdatePrompt.mockResolvedValue(undefined);

    const { outputAPI } = await import('../api');
    await outputAPI.update('p1', { name: 'x', category: 'output_constraint' });

    expect(mockUpdatePrompt).toHaveBeenCalledWith('p1', { name: 'x' });
    expect(mockUpdatePrompt).not.toHaveBeenCalledWith(expect.objectContaining({ model: expect.anything() }));
  });

  it('remove calls deletePrompt', async () => {
    mockDeletePrompt.mockResolvedValue(undefined);

    const { outputAPI } = await import('../api');
    await outputAPI.remove('p1');

    expect(mockDeletePrompt).toHaveBeenCalledWith('p1');
  });

  it('clone creates a copy with (副本) suffix and maps status, never model', async () => {
    mockCreatePrompt.mockResolvedValue({ ...sampleRow, name: 'Original (副本)' });

    const { outputAPI } = await import('../api');
    const item: OutputEntry = {
      id: 'p1',
      name: 'Original',
      content: 'content',
      category: 'output_constraint',
      status: 'active',
      createdAt: '2024-01-01',
    };
    const result = await outputAPI.clone(item);

    expect(mockCreatePrompt).toHaveBeenCalledWith({
      name: 'Original (副本)',
      category: 'output_constraint',
      content: 'content',
      status: 'active',
    });
    expect(mockCreatePrompt).not.toHaveBeenCalledWith(expect.objectContaining({ model: expect.anything() }));
    expect(result.name).toBe('Original (副本)');
  });

  it('removeBatch deletes multiple', async () => {
    mockDeletePrompt.mockResolvedValue(undefined);

    const { outputAPI } = await import('../api');
    await outputAPI.removeBatch(new Set(['p1', 'p2']));

    expect(mockDeletePrompt).toHaveBeenCalledTimes(2);
    expect(mockDeletePrompt).toHaveBeenCalledWith('p1', 0, expect.any(Array));
    expect(mockDeletePrompt).toHaveBeenCalledWith('p2', 1, expect.any(Array));
  });
});
