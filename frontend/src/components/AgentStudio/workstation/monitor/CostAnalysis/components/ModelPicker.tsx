import { useEffect, useMemo, useRef, useState } from 'react';
import { getModelAlias } from '../../shared/chartConstants';

interface ModelPickerProps {
  /** 完整模型名列表（来自 summary.by_model 的键） */
  models: string[];
  value: string; // 空串代表"所有模型"
  onChange: (model: string) => void;
  /** 受控的查询请求是否进行中（用于显示刷新中态） */
  isFetching?: boolean;
}

/**
 * 自定义模型下拉：原 `<select>` 的 option 弹层不可控（盖住卡片、文字截断、
 * 与深色主题色不一致）。替换为点击展开面板：
 * - 选中具体模型后下拉文字直接展示别名，不再回退到 "所有模型"
 * - 选项列表按别名分组排序，可点击外侧关闭
 * - 同步透传 isFetching 状态
 */
export function ModelPicker({ models, value, onChange, isFetching = false }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const options = useMemo(
    () => [...models].sort((a, b) => getModelAlias(a).localeCompare(getModelAlias(b))),
    [models],
  );

  const triggerLabel = value ? getModelAlias(value) : '所有模型';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium border transition-colors ${
          value
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
        }`}
      >
        <span className="truncate max-w-[180px]">{triggerLabel}</span>
        <svg className="w-3.5 h-3.5 opacity-70" fill="none" fillRule="evenodd" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] shadow-lg">
          <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">选择模型</span>
            {isFetching && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                刷新中
              </span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-hover)] ${
                value === '' ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-primary)]'
              }`}
            >
              所有模型
            </button>
            {options.length === 0 && (
              <p className="px-3 py-3 text-xs text-[var(--color-text-muted)]">当前区间内无模型数据</p>
            )}
            {options.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-hover)] truncate ${
                  value === m
                    ? 'text-[var(--color-accent)] font-medium'
                    : 'text-[var(--color-text-primary)]'
                }`}
                title={m}
              >
                {getModelAlias(m)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}