import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillEntry, SkillFormData } from '../skill.types';

const mockListSkills = vi.fn();
const mockCreateSkill = vi.fn();
const mockUpdateSkill = vi.fn();
const mockDeleteSkill = vi.fn();

vi.mock('../../../../../api/client/skills', () => ({
  listSkills: mockListSkills,
  createSkill: mockCreateSkill,
  updateSkill: mockUpdateSkill,
  deleteSkill: mockDeleteSkill,
}));

describe('skill api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const sampleRow = {
    id: 's1',
    name: 'Skill 1',
    description: 'A skill',
    category: 'general',
    version: 'v1',
    status: 'installed',
    author: 'author1',
    instructions: 'do this',
    prompt_id: 'p1',
    tool_names: ['tool1'],
    output_constraint: 'be concise',
    created_at: '2024-01-15T00:00:00Z',
  };

  it('fetchAll returns mapped entries', async () => {
    mockListSkills.mockResolvedValue([sampleRow]);

    const { skillAPI } = await import('../api');
    const result = await skillAPI.fetchAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Skill 1');
    expect(result[0].status).toBe('installed');
  });

  it('create calls createSkill and returns entry', async () => {
    mockCreateSkill.mockResolvedValue(sampleRow);

    const { skillAPI } = await import('../api');
    const data: SkillFormData = {
      name: 'New Skill',
      description: 'desc',
      category: 'general',
      version: 'v1',
      status: 'installed',
      author: 'author',
      instructions: 'do it',
      prompt_id: 'p1',
      tool_names: ['tool1'],
      output_constraint: 'be concise',
    };
    const result = await skillAPI.create(data);

    expect(mockCreateSkill).toHaveBeenCalledWith({
      name: 'New Skill',
      description: 'desc',
      category: 'general',
      version: 'v1',
      status: 'installed',
      author: 'author',
      instructions: 'do it',
      prompt_id: 'p1',
      tool_names: ['tool1'],
      output_constraint: 'be concise',
    });
    expect(result.name).toBe('Skill 1');
  });

  it('update calls updateSkill', async () => {
    mockUpdateSkill.mockResolvedValue(undefined);

    const { skillAPI } = await import('../api');
    await skillAPI.update('s1', { name: 'Updated' });

    expect(mockUpdateSkill).toHaveBeenCalledWith('s1', { name: 'Updated' });
  });

  it('remove calls deleteSkill', async () => {
    mockDeleteSkill.mockResolvedValue(undefined);

    const { skillAPI } = await import('../api');
    await skillAPI.remove('s1');

    expect(mockDeleteSkill).toHaveBeenCalledWith('s1');
  });

  it('clone creates a copy', async () => {
    mockCreateSkill.mockResolvedValue({ ...sampleRow, name: 'Original (副本)' });

    const { skillAPI } = await import('../api');
    const item: SkillEntry = {
      id: 's1',
      name: 'Original',
      description: 'desc',
      category: 'general',
      status: 'installed',
      version: 'v1',
      author: 'author',
      instructions: 'do it',
      prompt_id: 'p1',
      tool_names: ['tool1'],
      output_constraint: 'be concise',
      createdAt: '2024-01-01',
    };
    await skillAPI.clone(item);

    expect(mockCreateSkill).toHaveBeenCalledWith({
      name: 'Original (副本)',
      description: 'desc',
      category: 'general',
      version: 'v1',
      status: 'installed',
      author: 'author',
      instructions: 'do it',
    });
  });

  it('removeBatch deletes multiple', async () => {
    mockDeleteSkill.mockResolvedValue(undefined);

    const { skillAPI } = await import('../api');
    await skillAPI.removeBatch(new Set(['s1', 's2']));

    expect(mockDeleteSkill).toHaveBeenCalledTimes(2);
  });

  it('toEntry maps non-installed status', async () => {
    mockListSkills.mockResolvedValue([{ ...sampleRow, status: 'available' }]);

    const { skillAPI } = await import('../api');
    const result = await skillAPI.fetchAll();

    expect(result[0].status).toBe('available');
  });

  it('toEntry coerces non-standard status to installed', async () => {
    mockListSkills.mockResolvedValue([{ ...sampleRow, status: 'other' }]);

    const { skillAPI } = await import('../api');
    const result = await skillAPI.fetchAll();

    expect(result[0].status).toBe('installed');
  });

  it('toEntry handles missing optional fields', async () => {
    mockListSkills.mockResolvedValue([{
      ...sampleRow,
      instructions: null,
      prompt_id: null,
      output_constraint: null,
      tool_names: null,
    }]);

    const { skillAPI } = await import('../api');
    const result = await skillAPI.fetchAll();

    expect(result[0].instructions).toBe('');
    expect(result[0].prompt_id).toBe('');
    expect(result[0].output_constraint).toBe('');
    expect(result[0].tool_names).toEqual([]);
  });

  it('create handles optional fields as undefined', async () => {
    mockCreateSkill.mockResolvedValue(sampleRow);

    const { skillAPI } = await import('../api');
    const data: SkillFormData = {
      name: 'Minimal',
      description: '',
      category: 'general',
      version: '',
      status: 'installed',
      author: '',
      instructions: '',
      tool_names: [],
      output_constraint: '',
    };
    await skillAPI.create(data);

    expect(mockCreateSkill).toHaveBeenCalledWith({
      name: 'Minimal',
      description: '',
      category: 'general',
      version: '',
      status: 'installed',
      author: '',
      instructions: '',
      prompt_id: undefined,
      tool_names: [],
      output_constraint: '',
    });
  });
});
