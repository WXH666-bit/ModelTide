export function compact(n: number | undefined | null) {
  if (n == null) return '—';
  const [scale, unit] = n >= 1e9 ? [1e9, 'B'] : n >= 1e6 ? [1e6, 'M'] : n >= 1e3 ? [1e3, 'K'] : [1, ''];
  return new Intl.NumberFormat('en', { maximumFractionDigits: scale === 1 ? 0 : n / Number(scale) >= 100 ? 0 : 1 }).format(n / Number(scale)) + unit;
}
export const exact = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en').format(n);
