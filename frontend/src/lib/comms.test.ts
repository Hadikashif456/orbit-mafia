import { describe, it, expect } from 'vitest';
import { formatCountdown, calculateRoundTripSeconds } from './comms';

describe('comms simulation helpers', () => {
  it('formats seconds into mm:ss accurately', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-10)).toBe('00:00');
    expect(formatCountdown(59)).toBe('00:59');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(720)).toBe('12:00');
    expect(formatCountdown(1342)).toBe('22:22');
  });

  it('calculates round trip seconds from one-way minutes', () => {
    expect(calculateRoundTripSeconds(3)).toBe(360);
    expect(calculateRoundTripSeconds(14)).toBe(1680);
    expect(calculateRoundTripSeconds(22)).toBe(2640);
  });
});
