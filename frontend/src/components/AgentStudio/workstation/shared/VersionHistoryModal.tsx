import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, GitCompare, Loader2 } from 'lucide-react';
import { listVersions } from '../../../../api/client/versions';
import type { VersionEntry as ApiVersionEntry } from '../../../../api/client/versions';

interface Props {
  title: string;
  resourceType: string;
  resourceId: string;
  onClose: () => void;
}

interface DisplayVersion {
  version: string;
  date: string;
  author: string;
  changes: string;
  content?: string;
  raw: ApiVersionEntry;
}

interface DiffLine {
  text: string;
  type: 'added' | 'removed' | 'unchanged';
}

function computeDiff(oldText: string, newText: string): { old: DiffLine[]; new: DiffLine[] } {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length, n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const oldDiff: DiffLine[] = [], newDiff: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      oldDiff.unshift({ text: oldLines[i - 1], type: 'unchanged' });
      newDiff.unshift({ text: newLines[j - 1], type: 'unchanged' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newDiff.unshift({ text: newLines[j - 1], type: 'added' }); j--;
    } else {
      oldDiff.unshift({ text: oldLines[i - 1], type: 'removed' }); i--;
    }
  }
  return { old: oldDiff, new: newDiff };
}

function snapshotToDisplay(v: ApiVersionEntry): DisplayVersion {
  const snap = v.snapshot as Record<string, unknown>;
  return {
    version: `v${v.version_num}`,
    date: new Date(v.created_at).toLocaleString(),
    author: v.created_by || 'system',
    changes: `Version ${v.version_num}`,
    content: (snap.content as string) || (snap.name as string) || JSON.stringify(snap, null, 2),
    raw: v,
  };
}

export default function VersionHistoryModal({ title, resourceType, resourceId, onClose }: Props) {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<DisplayVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  useEffect(() => {
    listVersions(resourceType, resourceId)
      .then((items) => setVersions(items.map(snapshotToDisplay)))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [resourceType, resourceId]);

  const hasContent = versions.some((v) => v.content);
  const sortedSelection = [...selectedIndices].sort((a, b) => a - b);

  const diffResult = useMemo(() => {
    if (sortedSelection.length !== 2) return null;
    const older = versions[sortedSelection[0]];
    const newer = versions[sortedSelection[1]];
    if (!older?.content || !newer?.content) return null;
    return computeDiff(older.content, newer.content);
  }, [sortedSelection, versions]);

  return (
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] max-w-[var(--modal-m)] max-h-[calc(100dvh/1.618)] overflow-hidden max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h3>{t('workstation.versionHistory')} - {title}</h3>
          <div className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-compare-toolbar">
            {hasContent && (
              <button className={`btn btn-sm ${compareMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setCompareMode(!compareMode); setSelectedIndices([]); }}>
                <GitCompare size={14} />
                <span>{compareMode ? '退出对比' : '版本对比'}</span>
              </button>
            )}
            <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 px-4 text-center"><Loader2 size={32} className="animate-spin" /><p>{t('common.loading')}</p></div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 px-4 text-center"><p>暂无版本历史</p></div>
          ) : compareMode && (
            <p className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-compare-hint">
              点击选择两个版本进行对比
              {selectedIndices.length === 2 && (
                <span className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-compare-selected">
                  — 已选: {versions[selectedIndices[0]]?.version} vs {versions[selectedIndices[1]]?.version}
                </span>
              )}
            </p>
          )}

          {diffResult ? (
            <div className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-diff">
              <div className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-diff-pane">
                <h5>{versions[sortedSelection[0]]?.version}</h5>
                {diffResult.old.map((line, idx) => (
                  <div key={idx} className={`flex px-2.5 py-0.5 min-h-[1.4em] ${line.type === 'added' ? 'bg-[color-mix(in_srgb,var(--da-accent-green)_12%,transparent)]' : line.type === 'removed' ? 'bg-[color-mix(in_srgb,var(--da-accent-red)_12%,transparent)]' : ''}`}>{line.text}</div>
                ))}
              </div>
              <div className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-diff-pane">
                <h5>{versions[sortedSelection[1]]?.version}</h5>
                {diffResult.new.map((line, idx) => (
                  <div key={idx} className={`flex px-2.5 py-0.5 min-h-[1.4em] ${line.type === 'added' ? 'bg-[color-mix(in_srgb,var(--da-accent-green)_12%,transparent)]' : line.type === 'removed' ? 'bg-[color-mix(in_srgb,var(--da-accent-red)_12%,transparent)]' : ''}`}>{line.text}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-list">
              {versions.map((v, i) => (
                <div key={i} className={`p-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md transition-colors duration-150${compareMode ? ' cursor-pointer hover:border-[var(--color-accent)]' : ''}${selectedIndices.includes(i) ? ' border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]' : ''}`}
                  onClick={() => compareMode && setSelectedIndices((prev) => {
                    if (prev.includes(i)) return prev.filter((x) => x !== i);
                    if (prev.length >= 2) return [prev[1], i];
                    return [...prev, i];
                  })}>
                  <div className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-header">
                    <span className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-tag">{v.version}</span>
                    <span className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-date">{v.date}</span>
                    <span className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-author">{v.author}</span>
                    {selectedIndices.includes(i) && <span className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-check">✓</span>}
                  </div>
                  <p className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-changes">{v.changes}</p>
                  {v.content && <p className="font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-raised)] py-px px-2 rounded-content">{v.content.length > 120 ? v.content.slice(0, 120) + '…' : v.content}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
