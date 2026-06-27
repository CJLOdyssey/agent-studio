import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItemConfig {
  icon?: ReactNode;
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface WstaDropdownPortalProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  items: MenuItemConfig[];
  onClose: () => void;
}

export default function WstaDropdownPortal({ open, anchorEl, items, onClose }: WstaDropdownPortalProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open || !anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const menuWidth = 160;
  let left = rect.right - menuWidth;
  const top = rect.bottom + 4;

  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;

  return createPortal(
    <div
      ref={menuRef}
      className="wsta-dropdown-portal"
      style={{
        position: 'fixed',
        top,
        left,
        minWidth: menuWidth,
      }}
      role="menu"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="wsta-dropdown-divider" />
        ) : (
          <button
            key={i}
            className={`wsta-dropdown-item${item.danger ? ' wsta-dropdown-danger' : ''}`}
            role="menuitem"
            onClick={() => { item.onClick?.(); onClose(); }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>,
    document.body
  );
}
