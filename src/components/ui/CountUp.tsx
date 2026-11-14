import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

interface CountUpProps {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

/**
 * Numbers roll up from their previous value, so counters feel like they were
 * pencilled in rather than rendered.
 */
export function CountUp({ value, style, duration = 640 }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) {
      setDisplay(value);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress >= 1) clearInterval(timer);
    }, 32);
    return () => clearInterval(timer);
  }, [duration, value]);

  return <Text style={style}>{display}</Text>;
}
