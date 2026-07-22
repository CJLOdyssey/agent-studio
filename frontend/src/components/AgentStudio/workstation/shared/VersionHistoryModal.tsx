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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wsta-modal wsta-modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('workstation.versionHistory')} - {title}</h3>
          <div className="wsta-version-compare-toolbar">
            {hasContent && (
              <button className={`btn btn-sm ${compareMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setCompareMode(!compareMode); setSelectedIndices([]); }}>
                <GitCompare size={14} />
                <span>{compareMode ? '退出对比' : '版本对比'}</span>
              </button>
            )}
            <button className="modal-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="wsta-empty-state"><Loader2 size={32} className="animate-spin" /><p>{t('common.loading')}</p></div>
          ) : versions.length === 0 ? (
            <div className="wsta-empty-state"><p>暂无版本历史</p></div>
          ) : compareMode && (
            <p className="wsta-version-compare-hint">
              点击选择两个版本进行对比
              {selectedIndices.length === 2 && (
                <span className="wsta-version-compare-selected">
                  — 已选: {versions[selectedIndices[0]]?.version} vs {versions[selectedIndices[1]]?.version}
                </span>
              )}
            </p>
          )}

          {diffResult ? (
            <div className="wsta-version-diff">
              <div className="wsta-version-diff-pane">
                <h5>{versions[sortedSelection[0]]?.version}</h5>
                {diffResult.old.map((line, idx) => (
                  <div key={idx} className={`wsta-diff-line wsta-diff-${line.type}`}>{line.text}</div>
                ))}
              </div>
              <div className="wsta-version-diff-pane">
                <h5>{versions[sortedSelection[1]]?.version}</h5>
                {diffResult.new.map((line, idx) => (
                  <div key={idx} className={`wsta-diff-line wsta-diff-${line.type}`}>{line.text}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="wsta-version-list">
              {versions.map((v, i) => (
                <div key={i} className={`wsta-version-item ${compareMode ? 'wsta-version-item-selectable' : ''} ${selectedIndices.includes(i) ? 'wsta-version-item-selected' : ''}`}
                  onClick={() => compareMode && setSelectedIndices((prev) => {
                    if (prev.includes(i)) return prev.filter((x) => x !== i);
                    if (prev.length >= 2) return [prev[1], i];
                    return [...prev, i];
                  })}>
                  <div className="wsta-version-header">
                    <span className="wsta-version-tag">{v.version}</span>
                    <span className="wsta-version-date">{v.date}</span>
                    <span className="wsta-version-author">{v.author}</span>
                    {selectedIndices.includes(i) && <span className="wsta-version-check">✓</span>}
                  </div>
                  <p className="wsta-version-changes">{v.changes}</p>
                  {v.content && <p className="wsta-version-content">{v.content.length > 120 ? v.content.slice(0, 120) + '…' : v.content}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
