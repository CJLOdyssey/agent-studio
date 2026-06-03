import { Image, FileText, File, X } from 'lucide-react';
import type { AttachedFile } from '../../types/input';

interface Props {
  files: AttachedFile[];
  onRemove: (id: string) => void;
}

function getIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (/^(png|jpg|jpeg|gif|webp|svg)$/.test(ext || '')) return Image;
  if (/^(txt|md|doc|docx|pdf)$/.test(ext || '')) return FileText;
  return File;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Shared attachment list — used by both FileAttach (inside popover) and
 * InputToolbar (inline below the textarea). Single source of truth for
 * rendering attached files.
 */
export default function AttachmentList({ files, onRemove }: Props) {
  if (files.length === 0) return null;

  return (
    <div className="devagents-attached-files">
      {files.map((f) => {
        const Icon = getIcon(f.name);
        return (
          <span key={f.id} className="devagents-attached-file">
            <Icon size={14} />
            <span className="devagents-attached-file-name">{f.name}</span>
            <span className="devagents-attached-file-size">{fmtSize(f.size)}</span>
            <button
              className="devagents-attached-file-remove"
              onClick={() => onRemove(f.id)}
              type="button"
              aria-label={`Remove ${f.name}`}
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
    </div>
  );
}
