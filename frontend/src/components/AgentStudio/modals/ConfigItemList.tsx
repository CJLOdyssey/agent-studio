import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';

export interface ListItem {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  [key: string]: unknown;
}

interface Props<T extends ListItem> {
  title: string;
  items: T[];
  presets: { id: string; name: string; description?: string }[];
  editingId: string | null;
  emptyLabel: string;
  hideHeader?: boolean;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onUpdate: (id: string, name: string, desc: string) => void;
  onRemove: (id: string) => void;
  onStartEdit: (id: string) => void;
  onFinishEdit: () => void;
  onEditFull?: (item: T) => void;
}

function ItemMenu({ onEdit, onRename, onDelete }: { onEdit?: () => void; onRename: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left - 80 });
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <>
      <button ref={btnRef} className="inline-flex items-center justify-center p-1 rounded border-none bg-transparent text-[var(--color-text-muted)] cursor-pointer hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <MoreVertical size={14} />
      </button>
      {open && createPortal(
        <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-1 min-w-[140px] shadow-[0_4px_16px_rgba(0,0,0,0.15)] z-[99999]" style={{ position: 'fixed', top: pos.top, left: pos.left }}>
          {onEdit && (
            <button className="flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-150 border-none bg-transparent w-full text-sm text-[var(--color-text-secondary)] text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={() => { onEdit(); setOpen(false); }}>
              <Pencil size={14} /><span>{t('workstation.edit')}</span>
            </button>
          )}
          <button className="flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-150 border-none bg-transparent w-full text-sm text-[var(--color-text-secondary)] text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={() => { onRename(); setOpen(false); }}>
            <Pencil size={14} /><span>{t('workstation.rename')}</span>
          </button>
          <button className="flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-150 border-none bg-transparent w-full text-sm text-[var(--color-danger)] text-left hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]" onClick={() => { onDelete(); setOpen(false); }}>
            <Trash2 size={14} /><span>{t('workstation.delete')}</span>
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

export default function ConfigItemList<T extends ListItem>({
  title,
  items,
  presets,
  editingId,
  emptyLabel,
  hideHeader = false,
  onToggle,
  onAdd,
  onUpdate,
  onRemove,
  onStartEdit,
  onFinishEdit,
  onEditFull,
}: Props<T>) {
  const { t } = useTranslation();
  return (
    <div className="agent-config-list">
      {!hideHeader && (
        <div className="agent-config-list-header">
          <span>
            {title} ({items.length})
          </span>
          <button className="inline-flex items-center justify-center gap-2 px-2 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onAdd}>
            <Plus size={14} /> {t('configItem.add')}
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center justify-between px-3 py-[10px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg transition-[background] duration-150 hover:bg-[var(--color-surface-hover)] ${item.enabled ? '!bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] !border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)]' : ''}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={item.enabled} onChange={() => onToggle(item.id)} />
              <div className="flex flex-col">
                {editingId === item.id ? (
                  <ConfigItemEdit item={item} onUpdate={onUpdate} onFinishEdit={onFinishEdit} />
                ) : (
                  <>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{item.name}</span>
                    {item.description && <span className="text-xs text-[var(--color-text-muted)]">{item.description}</span>}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editingId !== item.id && (
                <ItemMenu
                  onEdit={onEditFull ? () => onEditFull(item) : undefined}
                  onRename={() => onStartEdit(item.id)}
                  onDelete={() => onRemove(item.id)}
                />
              )}
            </div>
          </div>
        ))}
        {presets
          .filter((p) => !items.some((i) => i.id === p.id))
          .map((p) => (
            <div key={p.id} className="flex items-center justify-between px-3 py-[10px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg transition-[background] duration-150 hover:bg-[var(--color-surface-hover)]">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{p.name}</span>
                  {p.description && <span className="text-xs text-[var(--color-text-muted)]">{p.description}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center justify-center p-1 rounded border-none bg-transparent text-[var(--color-text-muted)] cursor-pointer hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={() => onToggle(p.id)}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        {items.length === 0 && presets.length === 0 && <div className="text-center text-[var(--color-text-muted)] text-sm py-4">{emptyLabel}</div>}
      </div>
    </div>
  );
}

function ConfigItemEdit<T extends ListItem>({
  item,
  onUpdate,
  onFinishEdit,
}: {
  item: T;
  onUpdate: (id: string, name: string, desc: string) => void;
  onFinishEdit: () => void;
}) {
  return (
    <>
      <input
        className="w-full px-3 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm outline-none"
        value={item.name}
        autoFocus
        onChange={(e) => onUpdate(item.id, e.target.value, item.description || '')}
        onBlur={onFinishEdit}
        onKeyDown={(e) => e.key === 'Enter' && onFinishEdit()}
      />
      <input
        className="w-full px-3 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm outline-none"
        value={item.description || ''}
        onChange={(e) => onUpdate(item.id, item.name, e.target.value)}
        onBlur={onFinishEdit}
        onKeyDown={(e) => e.key === 'Enter' && onFinishEdit()}
      />
    </>
  );
}
