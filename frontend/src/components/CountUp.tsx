import { useEffect, useRef, useState, type FC } from 'react';

interface CountUpProps {
  value: number;
  start?: number;
  duration?: number;
  decimals?: number;
  className?: string;
}

export const CountUp: FC<CountUpProps> = ({
  value,
  start,
  duration = 900,
  decimals = 1,
  className,
}) => {
  const initialValue = start !== undefined ? start : value;
  const [displayValue, setDisplayValue] = useState<number>(initialValue);
  const prevValueRef = useRef<number>(initialValue);
  const isFirstRender = useRef<boolean>(true);

  useEffect(() => {
    // If it's the very first render and no start was given, stay at initialValue
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (start === undefined || start === value) {
        setDisplayValue(value);
        prevValueRef.current = value;
        return;
      }
    }

    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = to;

    if (from === to) {
      setDisplayValue(to);
      return;
    }

    const startTime = performance.now();
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(to);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, start, duration]);

  return <span className={className}>{displayValue.toFixed(decimals)}</span>;
};
