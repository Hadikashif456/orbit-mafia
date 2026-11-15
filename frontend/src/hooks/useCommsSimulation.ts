import { useState, useEffect } from 'react';
import { calculateRoundTripSeconds } from '../lib/comms';

export function useCommsSimulation(initialDelayMinutes: number = 14) {
  const [isEarthLinkLost, setIsEarthLinkLost] = useState<boolean>(true);
  const [delayMinutes, setDelayMinutes] = useState<number>(initialDelayMinutes);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    calculateRoundTripSeconds(initialDelayMinutes)
  );

  // Reset countdown whenever delay changes or link switches to lost
  useEffect(() => {
    if (isEarthLinkLost) {
      setRemainingSeconds(calculateRoundTripSeconds(delayMinutes));
    }
  }, [delayMinutes, isEarthLinkLost]);

  // Timer loop when link is lost
  useEffect(() => {
    if (!isEarthLinkLost) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Loop countdown to simulate ongoing round-trip delay window
          return calculateRoundTripSeconds(delayMinutes);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isEarthLinkLost, delayMinutes]);

  return {
    isEarthLinkLost,
    setIsEarthLinkLost,
    delayMinutes,
    setDelayMinutes,
    remainingSeconds,
  };
}
