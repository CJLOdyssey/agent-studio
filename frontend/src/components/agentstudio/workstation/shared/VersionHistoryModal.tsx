import { useState, useMemo } from 'react';
import { X, GitCompare } from 'lucide-react';
import type { VersionEntry } from '../types';

interface Props {
  title: string;
  versions: VersionEntry[];
  onClose: () => void;
}

interface DiffLine {
  text: string;
  type: 'added' | 'removed' | 'unchanged';
}

function computeDiff(oldText: string, newText: string): { old: DiffLine[]; new: DiffLine[] } {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const oldDiff: DiffLine[] = [];
  const newDiff: DiffLine[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      oldDiff.unshift({ text: oldLines[i - 1], type: 'unchanged' });
      newDiff.unshift({ text: newLines[j - 1], type: 'unchanged' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newDiff.unshift({ text: newLines[j - 1], type: 'added' });
      j--;
    } else {
      oldDiff.unshift({ text: oldLines[i - 1], type: 'removed' });
      i--;
    }
  }

  return { old: oldDiff, new: newDiff };
}

const CONTENT_PREVIEW_MAX = 120;

export default function VersionHistoryModal({ title, versions, onClose }: Props) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const hasContent = versions.some((v) => v.content);

  const toggleCompareMode = () => {
    setCompareMode((prev) => !prev);
    setSelectedIndices([]);
  };

  const toggleSelection = (index: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= 2) {
        return [prev[1], index];
      }
      return [...prev, index];
    });
  };

  const sortedSelection = [...selectedIndices].sort((a, b) => a - b);
  const diffResult = useMemo(() => {
    if (sortedSelection.length !== 2) return null;
    const older = versions[sortedSelection[0]];
    const newer = versions[sortedSelection[1]];
    if (!older.content || !newer.content) return null;
    return computeDiff(older.content, newer.content);
  }, [sortedSelection, versions]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wsta-modal wsta-modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>版本历史 - {title}</h3>
          <div className="wsta-version-compare-toolbar">
            {hasContent && (
              <button
                className={`btn btn-sm ${compareMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={toggleCompareMode}
              >
                <GitCompare size={14} />
                <span>{compareMode ? '退出对比' : '版本对比'}</span>
              </button>
            )}
            <button className="modal-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="modal-body">
          {compareMode && (
            <p className="wsta-version-compare-hint">
              点击选择两个版本进行对比
              {selectedIndices.length === 2 && (
                <span className="wsta-version-compare-selected">
                  — 已选: {versions[selectedIndices[0]]?.version} vs {versions[selectedIndices[1]]?.version}
                </span>
              )}
            </p>
          )}

          <div className="wsta-version-list">
            {versions.map((v, i) => {
              const isSelected = selectedIndices.includes(i);
              return (
                <div
                  key={i}
                  className={`wsta-version-item ${compareMode ? 'wsta-version-item-selectable' : ''} ${isSelected ? 'wsta-version-item-selected' : ''}`}
                  onClick={() => compareMode && toggleSelection(i)}
                >
                  <div className="wsta-version-header">
                    <span className="wsta-version-tag">{v.version}</span>
                    <span className="wsta-version-date">{v.date}</span>
                    <span className="wsta-version-author">{v.author}</span>
                    {isSelected && <span className="wsta-version-check">✓</span>}
                  </div>
                  <p className="wsta-version-changes">{v.changes}</p>
                  {v.content && (
                    <p className="wsta-version-content">
                      {v.content.length > CONTENT_PREVIEW_MAX
                        ? v.content.slice(0, CONTENT_PREVIEW_MAX) + '…'
                        : v.content}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {diffResult && (
            <div className="wsta-version-diff-container">
              <div className="wsta-version-diff-side">
                <div className="wsta-version-diff-header">
                  <span className="wsta-version-diff-label">旧版本</span>
                  <span className="wsta-version-diff-tag">{versions[sortedSelection[0]].version}</span>
                  <span className="wsta-version-diff-meta">{versions[sortedSelection[0]].date}</span>
                </div>
                <div className="wsta-version-diff-content">
                  {diffResult.old.map((line, li) => (
                    <div key={li} className={`wsta-version-diff-line wsta-version-diff-${line.type}`}>
                      <span className="wsta-version-diff-prefix">
                        {line.type === 'removed' ? '−' : line.type === 'added' ? '+' : ' '}
                      </span>
                      <span className="wsta-version-diff-text">{line.text || '\u00A0'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="wsta-version-diff-side">
                <div className="wsta-version-diff-header">
                  <span className="wsta-version-diff-label">新版本</span>
                  <span className="wsta-version-diff-tag">{versions[sortedSelection[1]].version}</span>
                  <span className="wsta-version-diff-meta">{versions[sortedSelection[1]].date}</span>
                </div>
                <div className="wsta-version-diff-content">
                  {diffResult.new.map((line, li) => (
                    <div key={li} className={`wsta-version-diff-line wsta-version-diff-${line.type}`}>
                      <span className="wsta-version-diff-prefix">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                      </span>
                      <span className="wsta-version-diff-text">{line.text || '\u00A0'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
