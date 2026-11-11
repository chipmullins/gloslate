import { formatCents } from '@/lib/money';

/** How the clean slate moment shows (You → Clean slate moment). "full" is the default. */
export type CelebrationStyle = 'full' | 'card' | 'sheet';

/** App-wide clean slate moment, shown over whatever screen is open. */
export type Celebration = {
  title: string;
  body?: string;
  /** The amount that gets wiped off the slate. */
  amountCents?: number;
  /** Force a style (the preview in settings); otherwise the person's setting. */
  style?: CelebrationStyle;
};
type Listener = (c: Celebration) => void;
const listeners = new Set<Listener>();
export const celebrate = {
  show(c: Celebration) { listeners.forEach((l) => l(c)); },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};

type Balance = { net_cents: number; with?: { member_id: string; cents: number }[] };
const played = new Set<string>();

/**
 * Plays the clean slate moment when a payment someone just confirmed (or
 * recorded as received) leaves them square with that person, or with the whole
 * tab. Only ever called right after that action, so never on app open; `key`
 * (the payment) makes sure it plays once per settle.
 */
export function celebrateIfSettled({ balance, otherId, otherName, amountCents, key }: {
  balance?: Balance; otherId?: string; otherName?: string; amountCents?: number; key?: string;
}) {
  if (!balance) return false;
  const withThem = otherId ? (balance.with ?? []).find((w) => w.member_id === otherId)?.cents ?? 0 : null;
  const squareWithThem = withThem === 0;
  if (!squareWithThem && balance.net_cents !== 0) return false;
  if (key) {
    if (played.has(key)) return false;
    played.add(key);
  }
  const amount = amountCents ? formatCents(amountCents) : null;
  celebrate.show({
    title: otherName && squareWithThem ? `Clean slate with ${otherName}.` : 'Clean slate.',
    body: otherName && amount ? `${otherName}'s ${amount} is confirmed. Nothing owed either way.`
      : otherName ? `You and ${otherName} are square.` : "You're square with everyone here.",
    amountCents,
  });
  return true;
}
