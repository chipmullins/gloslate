/**
 * Receipt parsing + itemizing. Pure functions, integer cents only, no imports
 * (so they run under plain Node tests: `npm run test:receipt`).
 */

export type ReceiptLine = { name: string; cents: number };
export type ParsedReceipt = { items: ReceiptLine[]; subtotalCents: number | null; taxCents: number; tipCents: number; totalCents: number | null };

const MONEY = /(-?)\$?\s?(\d{1,6}(?:,\d{3})*)[.,](\d{2})\s*(?:[A-Z]{1,2})?$/;
const SKIP = /\b(visa|mastercard|amex|discover|debit|credit|card|change|cash|tender|balance due|auth|approval|ref|tel|phone|www\.|thank|store|cashier|server|table|guest|order|receipt|savings|you saved)\b/i;

function toCents(sign: string, whole: string, dec: string) {
  const c = Number(whole.replace(/,/g, '')) * 100 + Number(dec);
  return sign === '-' ? -c : c;
}

/** OCR text lines (top to bottom) → items, tax, tip, totals. */
export function parseReceipt(lines: string[]): ParsedReceipt {
  const out: ParsedReceipt = { items: [], subtotalCents: null, taxCents: 0, tipCents: 0, totalCents: null };
  const totals: number[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const m = line.match(MONEY);
    if (!m) continue;
    const cents = toCents(m[1], m[2], m[3]);
    const label = line.slice(0, m.index).replace(/[.:*#@-]+$/, '').trim();
    const l = label.toLowerCase();
    if (/sub\s?-?total/.test(l)) out.subtotalCents = cents;
    else if (/\b(tax|hst|gst|vat)\b/.test(l)) out.taxCents += cents;
    else if (/\b(tip|gratuity|service charge)\b/.test(l)) out.tipCents += cents;
    else if (/\btotal\b|amount due|grand total/.test(l)) totals.push(cents);
    else if (label.length >= 2 && !SKIP.test(l) && Math.abs(cents) < 1_000_000) out.items.push({ name: label.replace(/^\d+\s*[xX@]?\s*/, '').slice(0, 60) || 'Item', cents });
  }
  // The real total is usually the largest "total" line (some receipts print "Total savings").
  out.totalCents = totals.length ? Math.max(...totals) : out.subtotalCents !== null ? out.subtotalCents + out.taxCents + out.tipCents : null;
  if (out.subtotalCents === null && out.items.length) out.subtotalCents = out.items.reduce((s, i) => s + i.cents, 0);
  return out;
}

export type AssignedItem = ReceiptLine & { memberIds: string[] };

/**
 * Exact split for an itemized receipt. Each item splits equally among the
 * people on it; tax and tip split in proportion to what each person ordered.
 * Leftover cents go to the payer (same rule as every Tabitat split).
 */
export function itemize(items: AssignedItem[], taxCents: number, tipCents: number, payerId: string): Record<string, number> {
  const base: Record<string, number> = {};
  for (const it of items) {
    if (it.memberIds.length === 0 || it.cents <= 0) continue;
    const each = Math.floor(it.cents / it.memberIds.length);
    let left = it.cents - each * it.memberIds.length;
    for (const m of it.memberIds) base[m] = (base[m] ?? 0) + each;
    const target = it.memberIds.includes(payerId) ? payerId : it.memberIds[0];
    base[target] += left;
    left = 0;
  }
  const subtotal = Object.values(base).reduce((a, b) => a + b, 0);
  const extra = taxCents + tipCents;
  const out: Record<string, number> = { ...base };
  if (subtotal > 0 && extra !== 0) {
    let given = 0;
    for (const m of Object.keys(base)) {
      const share = Math.floor((extra * base[m]) / subtotal);
      out[m] += share;
      given += share;
    }
    const rest = extra - given;
    const target = payerId in out ? payerId : Object.keys(base).sort((a, b) => base[b] - base[a])[0];
    out[target] += rest;
  }
  return out;
}
