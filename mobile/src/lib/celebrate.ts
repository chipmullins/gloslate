/** App-wide "you're settled up" moment, shown over whatever screen is open. */
export type Celebration = { title: string; body?: string };
type Listener = (c: Celebration) => void;
const listeners = new Set<Listener>();
export const celebrate = {
  show(c: Celebration) { listeners.forEach((l) => l(c)); },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};

/** Celebrate if this payment left you square with everyone in that tab. */
export function celebrateIfSettled(netCents: number | undefined, withName?: string) {
  if (netCents !== 0) return;
  celebrate.show({ title: 'All settled!', body: withName ? `You and ${withName} are square.` : "You're square with everyone." });
}
