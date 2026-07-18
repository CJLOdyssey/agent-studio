/**
 * Skill data + UI hook — rewritten to use useGenericCrud internally.
 *
 * Provides the same public interface for backward compatibility
 * while eliminating duplicate state management logic.
 */

import type { SkillEntry, SkillFormData } from './skill.types';
import { skillAPI } from './api';
import { validateSkillForm } from './validate';
import { useGenericCrud } from '../shared/useGenericCrud';
import type { GenericCrudReturn } from '../shared/useGenericCrud';

export type SkillSortField = 'name' | 'category' | 'status';
export type CategoryFilter = 'all' | string;

export interface SkillData extends GenericCrudReturn<SkillEntry, SkillFormData> {
  categoryFilter: CategoryFilter;
  setCategoryFilter: (v: CategoryFilter) => void;
  addSkill: (data: SkillFormData) => void;
  updateSkill: (id: string, data: Partial<SkillEntry>) => void;
  removeSkill: (id: string) => void;
  copySkill: (item: SkillEntry) => void;
  removeMultiple: (ids: Set<string>) => void;
}

export function useSkillData(): SkillData {
  const crud = useGenericCrud<SkillEntry, SkillFormData>({
    api: skillAPI,
    emptyForm: {
      name: '',
      description: '',
      category: '前端开发',
      status: 'installed',
      version: 'v1.0.0',
      author: '',
      instructions: '',
      prompt_id: '',
      tool_names: [],
      output_constraint: '',
    },
    itemName: 'Skill',
    validate: validateSkillForm,
    sortFields: ['name', 'category', 'status'],
    extraFilters: { categoryFilter: 'all' },
  });

  return {
    ...crud,
    get categoryFilter() { return crud.extraFilterValues.categoryFilter ?? 'all'; },
    setCategoryFilter: (v) => crud.setExtraFilter('categoryFilter', v),
    addSkill: crud.createItem,
    updateSkill: crud.updateItem,
    removeSkill: crud.removeItem,
    copySkill: crud.cloneItem,
    removeMultiple: crud.removeMultipleItems,
  };
}
