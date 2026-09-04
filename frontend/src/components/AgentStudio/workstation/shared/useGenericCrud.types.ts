/** 通用 CRUD hook 的类型——抽出以便独立导入。 */

import type { SortDir } from '../types';

/** 最小 CRUD 服务接口——各模块需自行适配。 */
export interface CrudAPI<T, F> {
  fetchAll(): Promise<T[]>;
  create(data: F): Promise<T>;
  update(id: string, data: Partial<T>): Promise<void>;
  remove(id: string): Promise<void>;
  clone?(item: T): Promise<T>;
  removeBatch?(ids: Set<string>): Promise<void>;
}

export interface GenericCrudConfig<T, F> {
  api: CrudAPI<T, F>;
  emptyForm: F;
  itemName: string;
  validate?: (data: F, items: T[], editingId?: string) => string[];
  /** 该实体可排序的字段键（可点击的表头列）。 */
  sortFields?: (keyof T)[];
  /** 变化时重置页码的额外筛选键。例：{ categoryFilter: 'all', statusFilter: 'all' } */
  extraFilters?: Record<string, string>;
}

export interface GenericCrudReturn<T, F> {
  /* 数据 */
  items: T[];
  isLoading: boolean;
  error: string | null;
  processed: T[];
  paged: T[];
  page: number;
  totalPages: number;
  search: string;
  sortField: keyof T | null;
  sortDir: SortDir;
  selectedIds: Set<string>;
  allOnPageSelected: boolean;
  extraFilterValues: Record<string, string>;

  /* 界面状态 */
  editingItem: T | null;
  deletingItem: T | null;
  historyItem: T | null;
  formData: F;
  formErrors: string[];
  isFormOpen: boolean;
  isDeleteOpen: boolean;
  isBatchDeleteOpen: boolean;
  isHistoryOpen: boolean;
  openMenuId: string | null;
  menuAnchorEl: HTMLElement | null;

  /* 设置器 */
  setSearch(v: string): void;
  setPage(v: number): void;
  setSelectedIds(v: Set<string> | ((prev: Set<string>) => Set<string>)): void;
  setOpenMenuId(v: string | null): void;
  setMenuAnchorEl(v: HTMLElement | null): void;
  setFormData(v: F | ((prev: F) => F)): void;
  setExtraFilter(key: string, value: string): void;
  handleSort(field: keyof T): void;
  toggleSelectAll(): void;
  toggleSelect(id: string): void;

  /* 操作 */
  openCreate(): void;
  openEdit(item: T): void;
  openDelete(item: T): void;
  handleSave(): Promise<void> | undefined;
  handleDelete(): Promise<void> | undefined;
  handleBatchDelete(): Promise<void> | undefined;
  openHistory(item: T): void;
  openBatchDelete(): void;
  closeForm(): void;
  closeDelete(): void;
  closeBatchDelete(): void;
  closeHistory(): void;
  closeMenu(): void;
  clearError(): void;
  retry(): void;
  batchAdd(items: T[]): void;

  /* 命令式数据变更（内部使用） */
  createItem(data: F): Promise<T>;
  updateItem(id: string, data: Partial<T>): Promise<void>;
  removeItem(id: string): Promise<void>;
  cloneItem(item: T): Promise<void>;
  removeMultipleItems(ids: Set<string>): Promise<void>;
}
