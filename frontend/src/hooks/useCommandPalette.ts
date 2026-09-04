import { useState, useCallback, useMemo } from 'react';
import type { CommandOption } from '../types/input';
import type * as React from 'react';

interface UseCommandPaletteReturn {
  open: boolean;
  query: string;
  filtered: CommandOption[];
  activeIndex: number;
  /** 从文本域的 onKeyDown 调用——事件已处理时返回 true */
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, value: string) => boolean;
  /** 按索引选择命令——返回替换文本 */
  selectCommand: (index: number) => string;
  /** 鼠标悬停时设置激活索引 */
  setActiveIndex: (index: number) => void;
  /** 强制关闭面板 */
  close: () => void;
  /** 从 onChange 调用——根据文本域值更新查询词 */
  updateFromValue: (value: string) => void;
}

/**
 * 斜杠命令面板状态机。
 *
 * 当用户在行首或空格后输入 '/' 时激活。
 * 随用户输入筛选命令，支持键盘导航，
 * 并返回要写入文本域的替换文本。
 */
export function useCommandPalette(commands: CommandOption[]): UseCommandPaletteReturn {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [slashIndex, setSlashIndex] = useState(-1); // 文本中 '/' 的位置

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)),
    );
  }, [commands, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
    setSlashIndex(-1);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, value: string): boolean => {
      if (!open) {
        // 检测 '/' 触发：在输入开头或空格之后
        if (e.key === '/' && (value === '' || value.endsWith(' '))) {
          setOpen(true);
          setQuery('');
          setActiveIndex(0);
          setSlashIndex(value.length); // '/' 输入的位置
          return false; // 让 '/' 正常插入
        }
        return false;
      }

      // ── 面板已打开 ──

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return true;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        return true;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return true;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // 选择由调用方通过 selectCommand 处理
        return true; // 调用方应调用 selectCommand 并替换文本
      }

      if (e.key === 'Backspace') {
        // 若退格越过 '/'，则关闭面板
        if (value.length <= slashIndex + 1) {
          close();
          return false; // 让退格正常发生
        }
        // 更新查询词——将由调用方从值中重算
        return false;
      }

      // 其他按键：根据值更新查询词
      // （调用方会从 '/' 之后提取查询词）
      return false;
    },
    [open, filtered.length, close, slashIndex],
  );

  const selectCommand = useCallback(
    (index: number): string => {
      if (index < 0 || index >= filtered.length) return '';
      const cmd = filtered[index];
      // 将 "/query" 替换为命令名 + 空格
      const replacement = `/${cmd.name} `;
      close();
      return replacement;
    },
    [filtered, close],
  );

  /** 从 onChange 调用——使查询词与文本域值保持同步 */
  const updateFromValue = useCallback(
    (value: string) => {
      if (!open) return;
      const q = slashIndex >= 0 ? value.slice(slashIndex + 1) : '';
      setQuery(q);
    },
    [open, slashIndex],
  );

  return {
    open,
    query,
    filtered,
    activeIndex,
    handleKeyDown,
    selectCommand,
    setActiveIndex,
    close,
    updateFromValue,
  };
}
