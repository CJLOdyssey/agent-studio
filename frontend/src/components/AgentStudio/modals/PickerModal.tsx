import { useState } from 'react';
import { X, Search, Plus } from 'lucide-react';

export interface PickerItem {
  id: string;
  name: string;
  description: string;
  source?: string;
}

interface Props {
  title: string;
  items: PickerItem[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}

export default function PickerModal({ title, items, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? items.filter(
        (i) => i.name.toLowerCase().includes(query.toLowerCase()) || i.description.toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  return (
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div
        className="w-[min(70vw,520px)] max-h-[min(70vh,560px)] bg-[var(--da-bg-secondary)] rounded-[14px] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pt-[18px] px-5">
          <h3 className="text-[var(--da-font-size-base)] font-semibold text-[var(--da-text-primary)] m-0">{title}</h3>
          <button className="bg-transparent border-none text-[var(--da-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 mx-5 my-3 px-3 py-2 bg-[var(--da-bg-elevated)] border border-[var(--da-border)] rounded-lg text-[var(--da-text-muted)]">
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索..."
            className="flex-1 bg-transparent border-none outline-none text-[var(--da-text-primary)] text-sm [&::placeholder]:text-[var(--da-text-muted)] [&::placeholder]:opacity-50"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[var(--da-text-muted)] text-sm">
              {query ? '无匹配结果' : '暂无可用条目，请先在工作台中创建'}
            </div>
          ) : (
            filtered.map((item) => (
              <button key={item.id} className="flex items-center gap-[10px] w-full px-3 py-[10px] bg-transparent border border-transparent rounded-lg text-[var(--da-text-primary)] cursor-pointer text-left transition-[background,border-color] duration-150 ease hover:bg-[var(--da-bg-hover)] hover:border-[var(--da-border)] group" onClick={() => onSelect(item)}>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-[var(--da-text-primary)]">{item.name}</span>
                  <span className="block text-xs text-[var(--da-text-muted)] mt-0.5 truncate">{item.description}</span>
                </div>
                {item.source && <span className="text-xs text-[var(--da-text-muted)] bg-[var(--da-bg-surface)] px-2 py-0.5 rounded whitespace-nowrap">{item.source}</span>}
                <Plus size={16} className="text-[var(--da-text-muted)] shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:text-[var(--color-accent)]" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
