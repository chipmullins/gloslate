import type { AssignedItem } from '@/lib/receipt';

/** Hand-off between Add and Itemize (same session, in memory). */
export type ReceiptDraft = {
  photoUri: string | null;
  /** Every line read off the receipt; `skipped` ones were left out of the split. */
  items: (AssignedItem & { skipped?: boolean })[];
  taxCents: number;
  tipCents: number;
  totalCents: number | null;
  /** Set by Itemize when the person taps Done. */
  result?: { amountCents: number; weights: Record<string, number>; participantIds: string[];
    /** Only the picked items, with tax and tip scaled to them (what gets saved with the expense). */
    picked: AssignedItem[]; taxCents: number; tipCents: number };
};

let draft: ReceiptDraft | null = null;
export const receiptDraft = {
  get: () => draft,
  set: (d: ReceiptDraft | null) => { draft = d; },
  patch: (p: Partial<ReceiptDraft>) => { if (draft) draft = { ...draft, ...p }; },
};
