export interface BaselineBand {
  mean: number;
  std: number;
  lower: number;
  upper: number;
}

/**
 * Calculates arithmetic mean of a sequence of numbers.
 */
export function mean(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Number((sum / values.length).toFixed(2));
}

/**
 * Calculates standard deviation (population std with N >= 1, or sample std when N > 1).
 */
export function std(values: number[]): number {
  if (!values || values.length <= 1) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Number(Math.sqrt(variance).toFixed(2));
}

/**
 * Calculates baseline band defined as mean +/- 2 * std.
 */
export function calculateBand(values: number[]): BaselineBand {
  const avg = mean(values);
  const deviation = std(values);
  const lower = Number((avg - 2 * deviation).toFixed(2));
  const upper = Number((avg + 2 * deviation).toFixed(2));

  return {
    mean: avg,
    std: deviation,
    lower,
    upper,
  };
}

/**
 * Checks whether a vital value falls outside the +/- 2*std baseline band.
 */
export function isOutOfBand(value: number, lower: number, upper: number): boolean {
  if (typeof value !== 'number' || isNaN(value)) return false;
  return value < lower || value > upper;
}
