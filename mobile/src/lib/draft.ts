import type { AssignedItem } from '@/lib/receipt';

/** Hand-off between Add and Itemize (same session, in memory). */
export type ReceiptDraft = {
  photoUri: string | null;
  items: AssignedItem[];
  taxCents: number;
  tipCents: number;
  totalCents: number | null;
  /** Set by Itemize when the person taps Done. */
  result?: { amountCents: number; weights: Record<string, number>; participantIds: string[] };
};

let draft: ReceiptDraft | null = null;
export const receiptDraft = {
  get: () => draft,
  set: (d: ReceiptDraft | null) => { draft = d; },
  patch: (p: Partial<ReceiptDraft>) => { if (draft) draft = { ...draft, ...p }; },
};
