/**
 * Normalizes an Egyptian mobile number to E.164 (+201XXXXXXXXX).
 * Accepts 01XXXXXXXXX, +201XXXXXXXXX, 00201XXXXXXXXX, and 201XXXXXXXXX, with spaces or dashes.
 * Valid mobile prefixes are 010, 011, 012, and 015. Returns null for anything else.
 */
export function normalizeEgyptianMobile(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, '');
  const match = /^(?:\+20|0020|20|0)(1[0125]\d{8})$/.exec(compact);
  return match ? `+20${match[1]}` : null;
}
