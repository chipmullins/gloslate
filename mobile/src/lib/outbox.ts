import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { api, ApiError, uploadReceipt, type Expense } from '@/lib/api';

/**
 * Expenses added without a connection wait here, on this device, and are sent when
 * Gloslate is reachable again. Each carries the client_id the server already uses to
 * ignore repeats, so a retry after a dropped response can never add it twice.
 */
export type OutboxItem = {
  clientId: string;
  householdId: string;
  /** What to show while it waits ("Costco run", "Groceries"). */
  label: string;
  amountCents: number;
  body: Record<string, unknown>;
  /** A copy of the receipt photo kept with the item (the original may be in a cache). */
  photoUri?: string;
  createdAt: string;
  /** Set when the server said no (not a connection problem): kept for the person to review. */
  failed?: string;
};

const WEB_KEY = 'gloslate.outbox';
let items: OutboxItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function file() {
  return new File(Paths.document, 'outbox.json');
}
function photoDir() {
  const d = new Directory(Paths.document, 'outbox-photos');
  if (!d.exists) d.create();
  return d;
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(WEB_KEY) : file().exists ? file().textSync() : null;
    items = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    items = [];
  }
}
function persist() {
  try {
    const raw = JSON.stringify(items);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(WEB_KEY, raw);
    else file().write(raw);
  } catch {
    // Storage full or unavailable: the item still lives in memory for this run.
  }
  emit();
}

/** True for "couldn't reach the server" (worth waiting out), false for a real answer. */
export function isOffline(e: unknown) {
  return e instanceof ApiError ? e.status === 0 || e.status >= 500 : true;
}

export const outbox = {
  list() { load(); return items; },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },

  /** Keep an expense to send later. Copies the receipt photo so it survives cache clean-up. */
  add(item: Omit<OutboxItem, 'createdAt' | 'photoUri'> & { photoUri?: string | null }) {
    load();
    let photoUri: string | undefined;
    if (item.photoUri && Platform.OS !== 'web') {
      try {
        const copy = new File(photoDir(), `${item.clientId}.jpg`);
        if (!copy.exists) new File(item.photoUri).copy(copy);
        photoUri = copy.uri;
      } catch {
        photoUri = item.photoUri;
      }
    }
    items = [...items.filter((i) => i.clientId !== item.clientId), { ...item, photoUri, createdAt: new Date().toISOString() }];
    persist();
    scheduleFlush(15000);
  },

  discard(clientId: string) {
    load();
    const it = items.find((i) => i.clientId === clientId);
    if (it?.photoUri && Platform.OS !== 'web') { try { new File(it.photoUri).delete(); } catch { /* gone already */ } }
    items = items.filter((i) => i.clientId !== clientId);
    persist();
  },

  retry(clientId: string) {
    load();
    items = items.map((i) => (i.clientId === clientId ? { ...i, failed: undefined } : i));
    persist();
    return flush();
  },
};

let flushing: Promise<number> | null = null;
let onSynced: ((n: number) => void) | null = null;
/** Called after items reach the server (the app refreshes balances and says so). */
export function onOutboxSynced(fn: (n: number) => void) { onSynced = fn; }

/** Sends everything waiting, oldest first. Stops at the first connection problem. */
export function flush(): Promise<number> {
  load();
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    for (const it of [...items].filter((i) => !i.failed)) {
      try {
        const res = await api<{ data: Expense }>(`/v1/households/${it.householdId}/expenses`, { body: { ...it.body, client_id: it.clientId } });
        if (it.photoUri) await uploadReceipt(res.data.id, it.photoUri).catch(() => {});
        outbox.discard(it.clientId);
        sent += 1;
      } catch (e) {
        if (isOffline(e)) break;
        items = items.map((i) => (i.clientId === it.clientId ? { ...i, failed: e instanceof ApiError ? e.message : 'Something went wrong.' } : i));
        persist();
      }
    }
    if (sent && onSynced) onSynced(sent);
    if (items.some((i) => !i.failed)) scheduleFlush(30000);
    return sent;
  })().finally(() => { flushing = null; });
  return flushing;
}

let timer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlush(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; flush().catch(() => {}); }, ms);
}

let started = false;
/** Try again whenever the app comes back to the foreground, and once at launch. */
export function startOutbox() {
  if (started) return;
  started = true;
  load();
  AppState.addEventListener('change', (s) => { if (s === 'active') flush().catch(() => {}); });
  if (Platform.OS === 'web') globalThis.addEventListener?.('online', () => { flush().catch(() => {}); });
  if (items.length) flush().catch(() => {});
}

export function useOutbox() {
  return useSyncExternalStore(outbox.subscribe, outbox.list, outbox.list);
}
