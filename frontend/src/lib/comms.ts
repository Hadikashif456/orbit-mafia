/**
 * Formats a duration in total seconds into mm:ss countdown format.
 */
export function formatCountdown(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const padMin = String(mins).padStart(2, '0');
  const padSec = String(secs).padStart(2, '0');
  return `${padMin}:${padSec}`;
}

/**
 * Calculates round-trip signal delay in seconds given one-way light-time delay in minutes.
 */
export function calculateRoundTripSeconds(oneWayMinutes: number): number {
  const sanitized = Math.max(0, oneWayMinutes);
  return Math.round(sanitized * 60 * 2);
}
