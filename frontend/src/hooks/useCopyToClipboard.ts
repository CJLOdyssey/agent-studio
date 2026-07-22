import { useCallback, useRef } from 'react';

export function useCopyToClipboard() {
  const copiedRef = useRef< Record<string, boolean>>({});

  const copy = useCallback(async (text: string, key?: string) => {
    const id = key || '_default';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-HTTPS or restricted contexts
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      copiedRef.current[id] = true;
      setTimeout(() => {
        copiedRef.current[id] = false;
      }, 2000);
      return true;
    } catch {
      copiedRef.current[id] = false;
      return false;
    }
  }, []);

  const isCopied = useCallback((key?: string) => {
    return !!copiedRef.current[key || '_default'];
  }, []);

  return { copy, isCopied };
}
