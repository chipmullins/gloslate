/** Money is integer cents everywhere. No floats, ever. */

export function formatCents(cents: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isInteger(cents)) throw new Error('cents must be an integer');
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const body = `$${dollars}.${String(abs % 100).padStart(2, '0')}`;
  if (opts.sign) return `${neg ? '−' : '+'}${body}`;
  return neg ? `−${body}` : body;
}

/**
 * Cash-register entry: digits fill in from the cents ("5" → 0.05, "512" → 5.12),
 * so nobody has to type the decimal point. Returns a dollar string for parseCents.
 */
export function centsFirst(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '').slice(0, 8); // up to $999,999.99, under the server's $1M ceiling
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  return `${Number(padded.slice(0, -2))}.${padded.slice(-2)}`;
}

/** Keypad input ("32.4", "1,200") → cents, without float math. */
export function parseCents(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, '');
  const m = clean.match(/^(\d{0,7})(?:\.(\d{0,2}))?$/);
  if (!m || (m[1] === '' && !m[2])) return null;
  return Number(m[1] || '0') * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}
