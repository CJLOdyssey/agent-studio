import { useCallback } from 'react';
import type { PromptEntry } from './types';

const REQUIRED_FIELDS = ['id', 'name', 'content', 'category', 'model', 'status', 'version', 'createdAt'] as const;
const VALID_STATUSES = new Set(['active', 'draft', 'archived']);

function isValidPromptEntry(raw: unknown): raw is PromptEntry {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    REQUIRED_FIELDS.every((f) => typeof o[f] === 'string') &&
    VALID_STATUSES.has(o.status as string)
  );
}

export function usePromptImportExport(
  getAllItems: () => PromptEntry[],
  addItems: (items: PromptEntry[]) => void,
) {
  const exportPrompts = useCallback(() => {
    const json = JSON.stringify(getAllItems(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompts-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getAllItems]);

  const importPrompts = useCallback((entries: unknown[]): { success: boolean; message: string } => {
    if (!Array.isArray(entries)) {
      return { success: false, message: '导入失败：JSON 格式应为数组' };
    }

    const valid: PromptEntry[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (!isValidPromptEntry(entries[i])) {
        return { success: false, message: `导入失败：第 ${i + 1} 条数据格式无效或缺少必填字段` };
      }
      valid.push(entries[i] as PromptEntry);
    }

    if (valid.length === 0) {
      return { success: false, message: '导入失败：未找到有效的提示词数据' };
    }

    const existingIds = new Set(getAllItems().map((p) => p.id));
    const newEntries = valid.filter((e) => !existingIds.has(e.id));
    const skipped = valid.length - newEntries.length;

    if (newEntries.length === 0) {
      return { success: false, message: `所有 ${valid.length} 条提示词已存在，无需导入` };
    }

    addItems(newEntries);
    return { success: true, message: `成功导入 ${newEntries.length} 条提示词${skipped > 0 ? `，跳过 ${skipped} 条已存在` : ''}` };
  }, [getAllItems, addItems]);

  return { exportPrompts, importPrompts };
}
