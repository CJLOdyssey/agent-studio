/** Types for the generic CRUD hook — extracted for independent import. */

import type { SortDir } from '../types';

/** Minimal CRUD service interface — must be adapted per module. */
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
  /** Sort field keys relevant for this entity (clickable column headers). */
  sortFields?: (keyof T)[];
  /** Extra filter keys that reset page on change. E.g. { categoryFilter: 'all', statusFilter: 'all' } */
  extraFilters?: Record<string, string>;
}

export interface GenericCrudReturn<T, F> {
  /* Data */
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

  /* UI */
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

  /* Setters */
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

  /* Actions */
  openCreate(): void;
  openEdit(item: T): void;
  openDelete(item: T): void;
  handleSave(): void;
  handleDelete(): void;
  handleBatchDelete(): void;
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

  /* Imperative data mutations (used internally) */
  createItem(data: F): Promise<T>;
  updateItem(id: string, data: Partial<T>): Promise<void>;
  removeItem(id: string): Promise<void>;
  cloneItem(item: T): Promise<void>;
  removeMultipleItems(ids: Set<string>): Promise<void>;
}
