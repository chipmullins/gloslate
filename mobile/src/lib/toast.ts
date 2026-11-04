/** Tiny app-wide toast channel (e.g. "Added Dinner · Undo" on Home). */
export type ToastMsg = { text: string; action?: { label: string; run: () => void }; ms?: number };
type Listener = (t: ToastMsg | null) => void;
const listeners = new Set<Listener>();
export const toast = {
  show(t: ToastMsg) { listeners.forEach((l) => l(t)); },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};
