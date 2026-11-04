/**
 * Mirrors the server's equal split (api/lib/hometab/ledger/split.rb) so the
 * Add button can show its result instantly. The server stays the authority.
 * Rule: everyone gets the floor; leftover cents go to the payer if they're in
 * it, otherwise one each in participant order.
 */
export function equalSplit(amount: number, payerId: string, ids: string[]): Record<string, number> {
  if (!Number.isInteger(amount) || amount <= 0 || ids.length === 0) return {};
  const floor = Math.floor(amount / ids.length);
  const shares: Record<string, number> = Object.fromEntries(ids.map((id) => [id, floor]));
  let left = amount - floor * ids.length;
  if (left && payerId in shares) shares[payerId] += left;
  else for (let i = 0; left > 0; i = (i + 1) % ids.length, left--) shares[ids[i]] += 1;
  return shares;
}

/** How an expense moves *my* balance (positive = I'm owed). */
export function effectFor(meId: string, payerId: string, shares: Record<string, number>): number {
  if (payerId === meId) return Object.entries(shares).reduce((s, [id, c]) => (id === meId ? s : s + c), 0);
  return -(shares[meId] ?? 0);
}

export function newClientId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
