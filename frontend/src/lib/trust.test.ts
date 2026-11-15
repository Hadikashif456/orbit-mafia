import { describe, it, expect } from 'vitest';
import { TRUST_ENTRIES, filterTrustEntries } from './trust';

describe('Data Trust Panel helpers', () => {
  it('contains entries across REAL_OSDR, SYNTHETIC, and CURATED provenances', () => {
    expect(TRUST_ENTRIES.length).toBeGreaterThan(0);
    const provenances = new Set(TRUST_ENTRIES.map((e) => e.provenance));
    expect(provenances.has('REAL_OSDR')).toBe(true);
    expect(provenances.has('SYNTHETIC')).toBe(true);
    expect(provenances.has('CURATED')).toBe(true);
  });

  it('ensures every entry explicitly details CRI role and limitation', () => {
    for (const entry of TRUST_ENTRIES) {
      expect(entry.id).toBeTruthy();
      expect(entry.datasetOrMetric).toBeTruthy();
      expect(entry.source).toBeTruthy();
      expect(entry.whatItFeedsInCRI).toBeTruthy();
      expect(entry.limitation).toBeTruthy();
      expect(entry.limitation.length).toBeGreaterThan(15);
    }
  });

  it('correctly filters entries by provenance', () => {
    const realOnly = filterTrustEntries(TRUST_ENTRIES, 'REAL_OSDR');
    expect(realOnly.every((e) => e.provenance === 'REAL_OSDR')).toBe(true);
    expect(realOnly.length).toBe(2);

    const syntheticOnly = filterTrustEntries(TRUST_ENTRIES, 'SYNTHETIC');
    expect(syntheticOnly.every((e) => e.provenance === 'SYNTHETIC')).toBe(true);
    expect(syntheticOnly.length).toBe(4);

    const all = filterTrustEntries(TRUST_ENTRIES, 'ALL');
    expect(all.length).toBe(TRUST_ENTRIES.length);
  });
});
