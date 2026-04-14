export function parsePositiveInt(
  value: string | number | null | undefined,
  fallback = 0
): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  if (!Number.isFinite(n)) return fallback;

  const intValue = Math.trunc(n);
  return intValue > 0 ? intValue : fallback;
}

export function formatMoney(
  amountCents: number,
  currency: string = "GBP",
  locale = "en-GB"
): string {
  const safeAmount = Number.isFinite(amountCents) ? amountCents : 0;
  const safeCurrency = currency || "GBP";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCurrency,
    }).format(safeAmount / 100);
  } catch {
    return `${(safeAmount / 100).toFixed(2)} ${safeCurrency}`;
  }
}

export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
