export const getCriChange = (trend: readonly number[]): string | null => {
  if (trend.length < 2) return null;
  return `${trend[0]} -> ${trend[trend.length - 1]}`;
};
