/** Whether the server said Gloslate is paused (Control's kill switch). */
export type PauseInfo = { message: string; since?: string | null };
type Listener = (p: PauseInfo | null) => void;
const listeners = new Set<Listener>();
let current: PauseInfo | null = null;

export const paused = {
  get: () => current,
  set(p: PauseInfo | null) {
    if (JSON.stringify(p) === JSON.stringify(current)) return;
    current = p;
    listeners.forEach((l) => l(p));
  },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};
