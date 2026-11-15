import { useEffect, useState } from 'react';

/**
 * Hook to detect low power / low capability runtime environments:
 * - Viewport width < 768px (mobile devices)
 * - User enables prefers-reduced-motion
 * - Hardware concurrency <= 4 (low core count / constrained devices)
 */
export function useLowPower(): boolean {
  const [lowPower, setLowPower] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isMobileWidth = window.innerWidth < 768;
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const isLowCoreCount =
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency <= 4;

    return isMobileWidth || prefersReducedMotion || isLowCoreCount;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const evaluateLowPower = () => {
      const isMobileWidth = window.innerWidth < 768;
      const prefersReducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      const isLowCoreCount =
        typeof navigator !== 'undefined' &&
        typeof navigator.hardwareConcurrency === 'number' &&
        navigator.hardwareConcurrency <= 4;

      setLowPower(isMobileWidth || prefersReducedMotion || isLowCoreCount);
    };

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    mediaQuery?.addEventListener?.('change', evaluateLowPower);
    window.addEventListener('resize', evaluateLowPower);

    return () => {
      mediaQuery?.removeEventListener?.('change', evaluateLowPower);
      window.removeEventListener('resize', evaluateLowPower);
    };
  }, []);

  return lowPower;
}
