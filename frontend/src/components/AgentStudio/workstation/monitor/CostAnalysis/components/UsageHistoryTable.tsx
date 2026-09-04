import { Fragment, useEffect, useRef, useState } from 'react';
import type {
  UsageHistoryItem,
  UsageOrderDir,
  UsageOrderKey,
} from '../../../../../../api/client/cost';
import { getModelAlias, getModelBadgeClass } from '../../shared/chartConstants';
import { formatCost, formatDateTime, formatSessionId, formatTokenCount } from '../../shared/format';
import WstaPagination from '../../../shared/WstaPagination';

interface UsageOrderState {
  key: UsageOrderKey;
  dir: UsageOrderDir;
}

interface UsageHistoryTableProps {
  /** 当前页数据（服务端分页 + 服务端搜索/排序后的结果，表格不再本地过滤） */
  items: UsageHistoryItem[];
  /** 作用域+搜索过滤后的总条数（服务端计算） */
  total: number;
  page: number;
  isFetching: boolean;
  /** 受控：搜索输入即时值（防抖在父层） */
  searchInput: string;
  onSearchChange: (value: string) => void;
  /** 受控：排序状态（服务端排序） */
  order: UsageOrderState;
  onSortChange: (key: UsageOrderKey) => void;
  onPageChange: (page: number) => void;
  /** 导出当前作用域+搜索条件全量（不再只导出已加载的一页） */
  onExportAll: () => Promise<void>;
}

/** 每页条数固定（大厂惯例：不提供切换，减少一个决策点）。 */
export const USAGE_PAGE_SIZE = 20;

/** 可排序列 → 服务端排序字段。会话列不可排序（后端无此白名单项）。 */
const SORTABLE_COLUMNS = [
  { key: 'timestamp', label: '时间', align: 'left' },
  { key: 'prompt_tokens', label: '输入', align: 'right' },
  { key: 'completion_tokens', label: '输出', align: 'right' },
  { key: 'cost_usd', label: '成本', align: 'right' },
] as const;

function SortIcon({ active, dir }: { active: boolean; dir: UsageOrderDir }) {
  // SVG 替代字符 ↕↑↓：字符在不同字体/主题下基线不齐、对比度差。
  const path = !active
    ? 'M8 9l4-4 4 4M8 15l4 4 4-4' // 未激活：上下双箭头
    : dir === 'asc'
      ? 'M5 15l7-7 7 7' // 升序 chevron-up
      : 'M19 9l-7 7-7-7'; // 降序 chevron-down
  return (
    <svg
      aria-hidden="true"
      className={`ml-1 inline-block h-3 w-3 transition-opacity ${
        active ? 'text-[var(--color-accent)] opacity-90' : 'opacity-30'
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

/**
 * 可排序表头按钮：真实 <button> 承载交互（Tab/Enter/Space 原生可用），
 * aria-sort 留在 <th> 上。内边距由按钮承担，保证热区 = 整个表头格。
 */
function SortHeaderButton({
  label,
  active,
  dir,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: UsageOrderDir;
  align: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-0.5 px-4 py-3 font-medium cursor-pointer select-none transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] ${
        align === 'right' ? 'justify-end text-right' : 'text-left'
      }`}
    >
      {label}
      <SortIcon active={active} dir={dir} />
    </button>
  );
}

/** 剪贴板写入，Clipboard API 不可用时降级 execCommand（非 secure context 等）。 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** 行稳定标识：完全由数据推导（run_id + 时间戳 + 模型），排序/翻页不漂移。 */
function rowKeyOf(item: UsageHistoryItem): string {
  return `${item.run_id}-${item.timestamp ?? item.date}-${item.model}`;
}

export function UsageHistoryTable({
  items,
  total,
  page,
  isFetching,
  searchInput,
  onSearchChange,
  order,
  onSortChange,
  onPageChange,
  onExportAll,
}: UsageHistoryTableProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // 按「行」而非 run_id 记录复制态：同一 run 可能产出多行记录，按 run_id 会同时亮勾。
  // 连续复制时重置前一个定时器，避免上一行的 2s 到点清掉当前行的对勾。
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );
  const handleCopy = async (runId: string, rowKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (await copyText(runId)) {
      setCopiedKey(rowKey);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // 排序/搜索/翻页都会换行集合，展开态指向的行可能已不在视图内，跟随失效。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setExpandedKey(null);
  }, [items]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExportAll();
    } finally {
      setExporting(false);
    }
  };

  // total 已含搜索过滤（服务端同口径计数），分页栏与表格天然一致。

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] shadow-sm">
      <div className="p-5 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">使用历史</h3>
            {searchInput.trim() && (
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                搜索 “{searchInput.trim()}”
              </p>
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-elevated)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {exporting ? '导出中…' : `导出全部 ${total} 条`}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="搜索会话 ID 或模型…"
              aria-label="搜索会话 ID 或模型"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onSearchChange('');
              }}
              className="w-full pl-9 pr-8 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {searchInput && (
              <button
                onClick={() => onSearchChange('')}
                aria-label="清空搜索"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
              {SORTABLE_COLUMNS.map(({ key, label, align }) => (
                <th
                  key={key}
                  aria-sort={order.key === key ? (order.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <SortHeaderButton
                    label={label}
                    active={order.key === key}
                    dir={order.dir}
                    align={align}
                    onClick={() => onSortChange(key)}
                  />
                </th>
              ))}
              <th className="px-4 py-3 font-medium">模型</th>
              <th className="px-4 py-3 font-medium">会话</th>
            </tr>
          </thead>
          <tbody className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {items.map((item) => {
              const key = rowKeyOf(item);
              const expanded = expandedKey === key;
              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => setExpandedKey(expanded ? null : key)}
                    aria-expanded={expanded}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                      <span
                        className={`mr-1.5 inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}
                        aria-hidden="true"
                      >
                        ▸
                      </span>
                      {formatDateTime(item.timestamp ?? item.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {formatTokenCount(item.prompt_tokens)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {formatTokenCount(item.completion_tokens)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--color-text-primary)]">
                      {item.unpriced ? (
                        <span className="text-[var(--color-warning)]" title="未定价模型，成本按 0 计">
                          —
                        </span>
                      ) : (
                        formatCost(item.cost_usd)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getModelBadgeClass(item.model)}`}
                        title={item.model}
                      >
                        {getModelAlias(item.model)}
                        {item.unpriced && (
                          <span
                            title="该模型未在本地定价表配置，成本按 0 计（并非免费）"
                            className="inline-flex"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => handleCopy(item.run_id, key, e)}
                        className="group inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        title={`完整 ID: ${item.run_id}\n点击复制`}
                      >
                        <span className="font-mono text-xs">{formatSessionId(item.run_id)}</span>
                        <span className="opacity-40 group-hover:opacity-100 transition-opacity">
                          {copiedKey === key ? (
                            <svg
                              className="w-3.5 h-3.5 text-[var(--color-success)]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-[var(--color-border)] last:border-0 bg-[var(--color-surface-hover)]/30">
                      <td colSpan={6} className="px-4 py-3">
                        <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                          <div className="flex gap-2 min-w-0">
                            <dt className="shrink-0 text-[var(--color-text-muted)]">会话 ID</dt>
                            <dd className="font-mono text-[var(--color-text-primary)] break-all">{item.run_id}</dd>
                          </div>
                          <div className="flex gap-2 min-w-0">
                            <dt className="shrink-0 text-[var(--color-text-muted)]">节点</dt>
                            <dd className="font-mono text-[var(--color-text-primary)] break-all">{item.node_id || '—'}</dd>
                          </div>
                          <div className="flex gap-2 min-w-0">
                            <dt className="shrink-0 text-[var(--color-text-muted)]">模型全名</dt>
                            <dd className="font-mono text-[var(--color-text-primary)] break-all">{item.model}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-[var(--color-text-muted)]">总 Token</dt>
                            <dd className="font-mono tabular-nums text-[var(--color-text-primary)]">{formatTokenCount(item.total_tokens)}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-[var(--color-text-muted)]">成本</dt>
                            <dd className="font-mono tabular-nums text-[var(--color-text-primary)]">
                              {item.unpriced ? '未计价' : formatCost(item.cost_usd)}
                            </dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-[var(--color-text-muted)]">时间</dt>
                            <dd className="font-mono text-[var(--color-text-primary)]">{formatDateTime(item.timestamp ?? item.date)}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <svg
                    className="w-12 h-12 mx-auto text-[var(--color-text-muted)] opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    {searchInput.trim() ? '当前搜索无匹配记录' : '暂无使用记录'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <WstaPagination
          embedded
          current={page + 1}
          pageSize={USAGE_PAGE_SIZE}
          total={total}
          onChange={(nextPage) => onPageChange(nextPage - 1)}
        />
      )}
    </div>
  );
}
