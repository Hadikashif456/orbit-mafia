import { describe, it, expect } from 'vitest';
import { mean, std, calculateBand, isOutOfBand } from './baseline';

describe('baseline band helpers', () => {
  it('calculates mean correctly', () => {
    expect(mean([])).toBe(0);
    expect(mean([10])).toBe(10);
    expect(mean([10, 20, 30])).toBe(20);
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it('calculates standard deviation correctly', () => {
    expect(std([])).toBe(0);
    expect(std([5])).toBe(0);
    // [10, 12, 14]: avg=12, diffs=[-2, 0, 2], squared=[4, 0, 4], sum=8, 8/(3-1)=4, sqrt=2
    expect(std([10, 12, 14])).toBe(2);
  });

  it('calculates band mean +/- 2*std', () => {
    const band = calculateBand([10, 12, 14]);
    expect(band.mean).toBe(12);
    expect(band.std).toBe(2);
    expect(band.lower).toBe(8);
    expect(band.upper).toBe(16);
  });

  it('identifies out-of-band values', () => {
    expect(isOutOfBand(12, 8, 16)).toBe(false);
    expect(isOutOfBand(8, 8, 16)).toBe(false);
    expect(isOutOfBand(16, 8, 16)).toBe(false);
    expect(isOutOfBand(7.9, 8, 16)).toBe(true);
    expect(isOutOfBand(16.1, 8, 16)).toBe(true);
  });
});
