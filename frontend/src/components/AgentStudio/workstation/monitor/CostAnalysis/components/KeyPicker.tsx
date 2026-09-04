import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listKeys } from '../../../../../../api/client/keys';

interface KeyPickerProps {
  /** 当前选中的 API key id；空串代表「所有密钥」 */
  value: string;
  onChange: (keyId: string) => void;
  /** 父级查询进行中（用于刷新中态） */
  isFetching?: boolean;
}

/**
 * 顶部「API 密钥」筛选下拉：与 ModelPicker 并列，按密钥（user_api_keys.id）过滤成本。
 * 数据源为当前用户自己的密钥列表（仅展示 label/前缀，不露明文）。
 * value='' 即「所有密钥」，配合图默认「所有模型 + 所有密钥」。
 */
export function KeyPicker({ value, onChange, isFetching = false }: KeyPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: keys = [], isFetching: keysFetching } = useQuery({
    queryKey: ['keys'],
    queryFn: listKeys,
  });

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

  const enabledKeys = useMemo(
    () =>
      keys
        .filter((k) => k.is_active)
        .sort((a, b) => (a.label || '').localeCompare(b.label || '')),
    [keys],
  );

  const selected = keys.find((k) => k.id === value);
  const triggerLabel = selected ? selected.label || selected.key_masked : '所有密钥';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={selected ? `${selected.label} · ${selected.key_masked}` : '按 API 密钥筛选'}
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
        <div className="absolute right-0 top-full mt-1 z-40 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] shadow-lg">
          <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">选择密钥</span>
            {(isFetching || keysFetching) && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">刷新中</span>
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
              所有密钥
            </button>
            {enabledKeys.length === 0 && (
              <p className="px-3 py-3 text-xs text-[var(--color-text-muted)]">暂无可用密钥</p>
            )}
            {enabledKeys.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  onChange(k.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-hover)] ${
                  value === k.id ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-primary)]'
                }`}
                title={k.label}
              >
                <span className="block truncate">
                  {k.label || k.provider || '未命名密钥'}
                </span>
                <span className="block truncate text-xs text-[var(--color-text-muted)]">
                  {k.provider} · {k.key_masked}
                  {k.is_default ? ' · 默认' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
