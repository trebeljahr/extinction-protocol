// Compact number formatter — keeps stat lines short once damage totals
// climb into the tens of thousands. 1234 → "1.2k", 1_500_000 → "1.5M".
export const fmtCompact = (n: number): string => {
  if (n < 1000) return Math.round(n).toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
};
