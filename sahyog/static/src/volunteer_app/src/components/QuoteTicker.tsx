import { useEffect, useRef, useState } from 'react';
import { Box, Text } from '@mantine/core';
import { apiGet } from '../api';

/** Daily Sadhguru quote in the desktop header. Renders as a static line
 *  when it fits; only becomes a seamless auto-scrolling ticker when the
 *  text actually overflows the available space (re-checked on resize). */
export function QuoteTicker() {
  const [quote, setQuote] = useState('');
  const [overflowing, setOverflowing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    apiGet<{ quote: string }>('/quote')
      .then((r) => setQuote(r.quote || ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!quote) return;
    const check = () => {
      const box = boxRef.current;
      const text = textRef.current;
      if (box && text) setOverflowing(text.scrollWidth > box.clientWidth);
    };
    check();
    const observer = new ResizeObserver(check);
    if (boxRef.current) observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, [quote]);

  if (!quote) return null;

  const line = `“${quote}” — Sadhguru`;
  const quoteText = (withRef: boolean) => (
    <Text
      span
      ref={withRef ? textRef : undefined}
      size="sm"
      c="dimmed"
      ff="heading"
      fs="italic"
      style={{ whiteSpace: 'nowrap' }}
    >
      {line}
    </Text>
  );

  return (
    <Box
      ref={boxRef}
      className={overflowing ? 'quote-ticker' : undefined}
      style={{ flex: 1, minWidth: 0, overflow: 'hidden', textAlign: overflowing ? undefined : 'center' }}
      mx="lg"
      aria-hidden="true"
    >
      {overflowing ? (
        <div className="quote-ticker-track">
          {quoteText(true)}
          {quoteText(false)}
        </div>
      ) : (
        quoteText(true)
      )}
    </Box>
  );
}
