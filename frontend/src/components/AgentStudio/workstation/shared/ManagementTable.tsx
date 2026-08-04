import type { ReactNode } from 'react';
import { Input, Select, Button } from 'antd';
import { Search, Plus, Trash2 } from 'lucide-react';
import type { GenericCrudReturn } from './useGenericCrud';
import WstaPagination from './WstaPagination';
import { TableSkeleton } from './LoadingSkeleton';
import { ErrorBoundary } from './ErrorBoundary';

export interface Column<T> {
  key: string;
  title: ReactNode;
  /** Applied to both <th> and <td> (e.g. 'w-[100px] text-right'). */
  className?: string;
  render: (item: T) => ReactNode;
}

export interface SelectOption {
  value: string;
  label: ReactNode;
}

interface ManagementTableProps<T extends { id: string }, F> {
  /** Result of useGenericCrud (or a module hook extending it). */
  crud: GenericCrudReturn<T, F>;
  /** aria-label for the region / table grid. */
  label: string;
  loadingLabel?: string;
  errorFallback?: ReactNode;

  columns: Column<T>[];

  searchPlaceholder: string;
  categoryOptions?: SelectOption[];
  categoryValue?: string;
  categorySelectWidth?: number;
  onCategoryChange?: (value: string) => void;
  statusOptions?: SelectOption[];
  statusValue?: string;
  statusSelectWidth?: number;
  onStatusChange?: (value: string) => void;

  createLabel: string;
  onCreate: () => void;
  /** Pre-formatted label incl. count, e.g. t('tool.batch_delete', String(size)). Shown when size > 0. */
  batchDeleteLabel?: string;
  onBatchDelete?: () => void;

  selectAllLabel: string;
  selectItemLabel: (item: T) => string;
  rowSelectable?: (item: T) => boolean;
  rowClassName?: (item: T) => string;

  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptySearchDescription: string;

  pageSize?: number;
}

export default function ManagementTable<T extends { id: string }, F>({
  crud,
  label,
  loadingLabel,
  errorFallback,
  columns,
  searchPlaceholder,
  categoryOptions,
  categoryValue,
  categorySelectWidth = 130,
  onCategoryChange,
  statusOptions,
  statusValue,
  statusSelectWidth = 120,
  onStatusChange,
  createLabel,
  onCreate,
  batchDeleteLabel,
  onBatchDelete,
  selectAllLabel,
  selectItemLabel,
  rowSelectable = () => true,
  rowClassName,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptySearchDescription,
  pageSize = 7,
}: ManagementTableProps<T, F>) {
  const rowClass = (item: T) => (rowClassName ? rowClassName(item) : (crud.selectedIds.has(item.id) ? 'wsta-row-selected' : ''));
  const rows = crud.processed.slice((crud.page - 1) * pageSize, crud.page * pageSize);

  if (crud.isLoading) {
    return (
      <div className="flex flex-col h-full" role="region" aria-label={loadingLabel ?? label}>
        <TableSkeleton rows={5} cols={columns.length} />
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={errorFallback}>
      <div className="flex flex-col h-full" role="region" aria-label={label}>
        <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar">
          <div className="flex items-center gap-3 flex-1">
            <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={searchPlaceholder} value={crud.search} onChange={(e) => crud.setSearch(e.target.value)} />
            {categoryOptions && onCategoryChange && (
              <Select style={{ width: categorySelectWidth }} value={categoryValue} onChange={onCategoryChange} options={categoryOptions} />
            )}
            {statusOptions && onStatusChange && (
              <Select style={{ width: statusSelectWidth }} value={statusValue} onChange={onStatusChange} options={statusOptions} />
            )}
          </div>
          <div className="flex items-center gap-3">
            {onBatchDelete && crud.selectedIds.size > 0 && (
              <Button danger icon={<Trash2 size={16} />} onClick={onBatchDelete}>{batchDeleteLabel}</Button>
            )}
            {onCreate && (
              <Button type="primary" icon={<Plus size={16} />} onClick={onCreate}>{createLabel}</Button>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
          {crud.processed.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center">
              {emptyIcon}
              <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{emptyTitle}</div>
              <div className="text-sm text-[var(--color-text-muted)] max-w-80 leading-relaxed">{crud.search ? emptySearchDescription : emptyDescription}</div>
            </div>
          ) : (
            <table className="w-full table-fixed border-collapse text-sm" role="grid" aria-label={label}>
              <thead><tr>
                <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={crud.allOnPageSelected} onChange={crud.toggleSelectAll} aria-label={selectAllLabel} /></th>
                {columns.map((col) => (
                  <th key={col.key} className={col.className} scope="col">{col.title}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className={rowClass(item)}>
                    <td className="w-10 text-center align-middle p-1 px-2">
                      <input type="checkbox" checked={crud.selectedIds.has(item.id)} onChange={() => crud.toggleSelect(item.id)} disabled={!rowSelectable(item)} aria-label={selectItemLabel(item)} />
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>{col.render(item)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <WstaPagination current={crud.page} total={crud.processed.length} pageSize={pageSize} onChange={(p) => crud.setPage(p)} />
      </div>
    </ErrorBoundary>
  );
}
