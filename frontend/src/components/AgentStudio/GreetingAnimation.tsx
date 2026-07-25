import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function GreetingAnimation() {
  const { t } = useTranslation();
  const greeting = t('home.greeting');
  const [displayed, setDisplayed] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < greeting.length) {
        setDisplayed(greeting.slice(0, index + 1));
        index++;
      } else {
        setComplete(true);
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [greeting]);

  return (
    <h1 className="text-[clamp(24px,4vw,32px)] leading-[1.2] font-bold tracking-tight text-[var(--da-text-primary)] m-0 mb-2 inline-flex items-center text-balance">
      {displayed}
      {!complete && <span className="inline-block text-[var(--da-text-muted)] font-light animate-[blink_0.8s_step-end_infinite] ml-0.5">|</span>}
    </h1>
  );
}
