/** 格式化价格 ¥0.00 */
export function formatPrice(val: number | string | null | undefined): string {
  if (val == null) return '—';
  return `¥${Number(val).toFixed(2)}`;
}
