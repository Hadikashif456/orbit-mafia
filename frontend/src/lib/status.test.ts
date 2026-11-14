import { describe, it, expect } from 'vitest';
import { getStatus } from './status';

describe('getStatus helper boundary validation', () => {
  it('classifies CRI >= 75 as green', () => {
    expect(getStatus(100)).toBe('green');
    expect(getStatus(85)).toBe('green');
    expect(getStatus(75)).toBe('green');
  });

  it('classifies CRI between 50 and 74.99 as amber', () => {
    expect(getStatus(74.9)).toBe('amber');
    expect(getStatus(74)).toBe('amber');
    expect(getStatus(61.2)).toBe('amber');
    expect(getStatus(50)).toBe('amber');
  });

  it('classifies CRI < 50 as red', () => {
    expect(getStatus(49.9)).toBe('red');
    expect(getStatus(49)).toBe('red');
    expect(getStatus(20)).toBe('red');
    expect(getStatus(0)).toBe('red');
  });
});
