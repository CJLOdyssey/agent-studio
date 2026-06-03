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
      } else { setComplete(true); clearInterval(timer); }
    }, 100);
    return () => clearInterval(timer);
  }, [greeting]);

  return (
    <h1 className="devagents-home-greeting">{displayed}{!complete && <span className="typing-cursor">|</span>}</h1>
  );
}
