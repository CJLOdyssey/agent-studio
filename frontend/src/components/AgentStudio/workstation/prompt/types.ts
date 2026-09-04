import type { GenericCrudReturn } from '../shared/useGenericCrud';

export interface PromptEntry {
  id: string;
  name: string;
  /** 提示词用途说明。后端暂未提供 description 字段，为前端 UI 字段（仅编辑回显，不持久化）。 */
  description?: string;
  content: string;
  category: PromptCategory;
  model: string;
  status: 'active' | 'draft' | 'archived';
  version: string;
  createdAt: string;
}

export type PromptFormData = Omit<PromptEntry, 'id' | 'createdAt'>;

export type PromptCategory = string;

export type PromptSortField = 'name' | 'category' | 'status';

export type CategoryFilter = 'all' | PromptCategory;

/** Prompt 管理的数据 + UI 状态 + CRUD 操作。 */
export interface PromptData extends GenericCrudReturn<PromptEntry, PromptFormData> {
  categoryFilter: CategoryFilter;
  setCategoryFilter: (v: CategoryFilter) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  addPrompt: (data: PromptFormData) => void;
  updatePrompt: (id: string, data: Partial<PromptEntry>) => void;
  removePrompt: (id: string) => void;
  copyPrompt: (item: PromptEntry) => void;
  removeMultiple: (ids: Set<string>) => void;
  /** 暴露给导入/导出组合——返回全部条目（未过滤、未排序） */
  getAllItems: () => PromptEntry[];
  /** 暴露给导入/导出组合——批量追加新条目 */
  addItems: (newItems: PromptEntry[]) => void;
}
