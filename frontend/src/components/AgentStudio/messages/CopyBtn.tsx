import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';

export function CopyBtn({ text, label, className }: { text: string; label?: string; className?: string }) {
  const { copy, isCopied } = useCopyToClipboard();
  const { t } = useTranslation();
  const key = text.slice(0, 32);
  const copied = isCopied(key);
  return (
    <button
      className={`${className || 'agentstudio-msg-copy'}${copied ? ' copied' : ''}`}
      onClick={() => copy(text, key)}
      title={copied ? t('teamMessage.copied') : label}
      aria-label={copied ? t('teamMessage.copied') : label}
    >
      {copied ? (
        <>
          <Check size={12} />
          <span className="agentstudio-msg-copy-text">{t('teamMessage.copied')}</span>
        </>
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}
