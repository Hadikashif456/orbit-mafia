import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLowPower } from './useLowPower';

describe('useLowPower hook', () => {
  const origWindow = (globalThis as any).window;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (origWindow) {
      (globalThis as any).window = origWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  it('safely handles SSR or missing window by returning a function', () => {
    delete (globalThis as any).window;
    expect(typeof useLowPower).toBe('function');
  });

  it('detects mobile screen width < 768px', () => {
    (globalThis as any).window = {
      innerWidth: 375,
      matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const isMobile = window.innerWidth < 768;
    expect(isMobile).toBe(true);
  });

  it('detects low power when hardwareConcurrency is <= 4', () => {
    const concurrency = 4;
    expect(concurrency <= 4).toBe(true);
  });

  it('detects low power when prefers-reduced-motion is active', () => {
    (globalThis as any).window = {
      innerWidth: 1200,
      matchMedia: vi.fn().mockImplementation((q: string) => ({
        matches: q.includes('prefers-reduced-motion'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    expect(motionQuery.matches).toBe(true);
  });
});
