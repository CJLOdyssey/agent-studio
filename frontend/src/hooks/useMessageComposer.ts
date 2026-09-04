import { useState, useCallback, useRef } from 'react';
import { validateInput } from '../utils/validation';
import type * as React from 'react';

interface UseMessageComposerOptions {
  /** 外部提交处理器——接收清洗后的文本 */
  onSend: (text: string) => void;
  /** 允许的最大字符数 */
  maxLength?: number;
  /** 发送模式：'enter' = Enter 发送，'ctrl-enter' = Ctrl+Enter 发送 */
  sendMode?: 'enter' | 'ctrl-enter';
}

interface UseMessageComposerReturn {
  value: string;
  setValue: (v: string) => void;
  /** 用于筛选/搜索的延迟值（避免快速输入时卡顿） */
  submit: () => boolean;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** 输入框含非空白内容时为 true */
  hasContent: boolean;
  charCount: number;
  maxLength: number;
}

/**
 * 自包含的消息输入状态机。
 *
 * 所有输入状态都集中在此——每次按键不触发父组件重渲染。
 * 用 ref 在回调中始终读取最新值，避免闭包过期。
 */
export function useMessageComposer({ onSend, maxLength = 10000, sendMode = 'enter' }: UseMessageComposerOptions): UseMessageComposerReturn {
  const [value, setValue] = useState('');
  const valueRef = useRef(value);
  // 渲染期间保持 ref 同步——有意为之，避免回调中的闭包过期
  valueRef.current = value; // eslint-disable-line react-hooks/refs

  const hasContent = value.trim().length > 0;
  const charCount = value.length;

  const submit = useCallback((): boolean => {
    const text = valueRef.current;
    const { valid, sanitized } = validateInput(text);
    if (!valid) {
      // 清空纯空白输入，避免误按 Enter 产生噪音
      if (!text.trim()) setValue('');
      return false;
    }
    setValue('');
    onSend(sanitized);
    return true;
  }, [onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 忽略 IME 组合事件——按 Enter 确认候选字
      // （中文/日文/韩文）时绝不能发送。
      if (e.nativeEvent.isComposing) return;

      if (sendMode === 'enter') {
        // Enter 发送，Shift+Enter 换行
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          submit();
        }
      } else {
        // Ctrl+Enter 发送，Enter 换行
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      }
    },
    [submit, sendMode],
  );

  return { value, setValue, submit, handleKeyDown, hasContent, charCount, maxLength };
}
