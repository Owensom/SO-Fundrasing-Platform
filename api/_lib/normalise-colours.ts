export function normaliseColours(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const cleaned = input
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return [...new Set(cleaned)];
}
