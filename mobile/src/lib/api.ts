import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Release builds always reach the live server, even if no .env file was picked up.
// The web app (app.tabitat.app) is served by the API server itself, so it
// calls the API on its own origin: no cross-site requests.
const BASE = Platform.OS === 'web' && !__DEV__
  ? ''
  : process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3000' : 'https://api.tabitat.app');
const TOKEN_KEY = 'tabitat.session';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// SecureStore is native-only. On the web the sign-in lives in this site's
// storage (the page's strict content policy keeps other scripts out); if
// storage is blocked (private mode), it lasts until the tab closes.
let memoryToken: string | null = null;
const webStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export const tokenStore = {
  async get() {
    if (Platform.OS === 'web') {
      try { return webStorage()?.getItem(TOKEN_KEY) ?? memoryToken; } catch { return memoryToken; }
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string | null) {
    if (Platform.OS === 'web') {
      memoryToken = token;
      try {
        if (token) webStorage()?.setItem(TOKEN_KEY, token);
        else webStorage()?.removeItem(TOKEN_KEY);
      } catch { /* memory only */ }
      return;
    }
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const token = init.token === undefined ? await tokenStore.get() : init.token;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach Gloslate. Check your connection.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong. Try again.');
  return data as T;
}

// ---- Shapes returned by the API ----

export type Handles = { venmo?: string; cashapp?: string; zelle?: string };

export type Member = {
  id: string;
  display_name: string;
  moved_in_on?: string | null;
  moved_out_on?: string | null;
  auto_remind?: boolean;
  remind_threshold_cents?: number;
  remind_after_days?: number;
  first_name: string;
  placeholder: boolean;
  former: boolean;
  you: boolean;
  handles: Handles;
};

export type Balance = { net_cents: number; with: { member_id: string; cents: number }[] };

/** A home (people who live together) or a group (a trip, dinners, friends). */
export type HouseholdKind = 'home' | 'group';
export type HouseholdSummary = {
  id: string; kind: HouseholdKind; name: string; member_count: number; balance: Balance; created_at?: string;
  /** First names of everyone else in it (up to 5). */
  people?: string[];
};
/** One payment in the quickest way to settle everyone up. */
export type Transfer = { from_member_id: string; to_member_id: string; cents: number };

export type Household = HouseholdSummary & {
  me: Member;
  members: Member[];
  simplify_debts: boolean;
  statement_day: number;
  settle_plan: Transfer[];
  total_spent_cents: number;
};

export type User = {
  id: string;
  first_name: string;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
  time_zone: string;
  quiet_start_hour: number;
  quiet_end_hour: number;
  face_id_lock: boolean;
  notification_prefs: Record<string, 'on' | 'off' | 'daily'>;
  identities: { id: string; provider: string }[];
};

export type SignInResult =
  | { status: 'signed_in'; token: string; new_user: boolean; user: User }
  | { status: 'link_offer'; link_token: string; existing_methods: string[] };

export type InvitePreview = {
  open: boolean;
  household_name: string;
  inviter: string;
  for_member_id: string | null;
  spots: { id: string; first_name: string }[];
  members: string[];
};

export type Expense = {
  id: string;
  household_id?: string;
  amount_cents: number;
  description: string;
  category: string;
  spent_on: string;
  payer_id: string;
  created_by_id: string;
  split_kind: 'equal' | 'percent' | 'exact' | 'shares';
  split_weights: Record<string, number>;
  urgency: 'soon' | 'tab';
  note: string | null;
  shares: { member_id: string; cents: number }[];
  /** Who paid how much; one entry unless several people chipped in. */
  payers?: { member_id: string; cents: number }[];
  effect_for_me_cents: number;
  edited: boolean;
  deleted: boolean;
  has_receipt?: boolean;
  itemization?: { items: { name: string; cents: number; member_ids: string[] }[]; tax_cents: number; tip_cents: number } | null;
  can_edit: boolean;
  created_at: string;
  history?: { kind: string; actor_member_id: string | null; at: string; data: Record<string, any> }[];
};

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'household', label: 'Household' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'rent', label: 'Rent' },
  { key: 'other', label: 'Other' },
];
export const categoryLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? 'Other';

export type Bill = {
  id: string; name: string; kind: 'fixed' | 'variable'; amount_cents: number | null; due_day: number;
  post_days_early: number; category: string; payer_id: string; you_pay: boolean; can_manage: boolean; participant_ids: string[];
};
export type BillCycle = {
  id: string; bill_id: string; name: string; kind: 'fixed' | 'variable'; due_on: string;
  status: 'upcoming' | 'waiting' | 'posted' | 'skipped'; amount_cents: number | null; payer_id: string;
  you_pay: boolean; can_manage: boolean; missing: boolean; hint_cents: number | null; overridden: boolean;
};
export type Payment = {
  id: string; household_id?: string; from_member_id: string; to_member_id: string; amount_cents: number; method: string;
  status: 'pending' | 'confirmed' | 'disputed'; note: string | null; marked_at: string; confirmed_at: string | null;
  auto_confirm_at: string | null; auto_confirmed: boolean; you_sent: boolean; you_received: boolean;
  can_confirm: boolean; can_dispute: boolean;
  thread?: { kind: string; actor_member_id: string | null; at: string; note: string | null }[];
};
export type BreakdownItem = {
  expense_id: string; description: string; category: string; spent_on: string; payer_id: string;
  cents: number; paid_cents: number; status: 'open' | 'partial' | 'paid';
};
export type Breakdown = { net_cents: number; credit_cents: { theirs: number; mine: number }; items: BreakdownItem[]; payments: Payment[] };
export type PayInfo = {
  amount_cents: number; dollars: string; memo: string; to_first_name: string;
  links: { venmo?: { app: string; web: string }; cashapp?: { app: string; web: string }; zelle?: { copy: string; amount: string } };
};
export type StatementSummary = { id: string; title: string; period_start: string; period_end: string; summary: string };
export type Statement = StatementSummary & {
  you: string;
  data: {
    names: Record<string, string>;
    expenses: { id: string; description: string; category: string; spent_on: string; amount_cents: number; payer_id: string; shares: Record<string, number> }[];
    payments: { id: string; from: string; to: string; amount_cents: number; method: string; confirmed_at: string }[];
    adjustments: { expense_id: string; kind: string; description: string; before_cents: number | null; after_cents: number | null }[];
    totals: { spent_cents: number; paid_by: Record<string, number>; share_of: Record<string, number>; settled_cents: number };
    transfers: { from: string; to: string; cents: number }[];
  };
};
export type NotificationItem = { id: string; kind: string; title: string; body: string; data: { route?: string }; created_at: string; read: boolean };

export const API_BASE = BASE;

/** Attaches a receipt photo to an expense (multipart upload). */
export async function uploadReceipt(expenseId: string, uri: string) {
  const token = await tokenStore.get();
  const form = new FormData();
  const name = uri.split('/').pop() || 'receipt.jpg';
  const type = name.toLowerCase().endsWith('.png') ? 'image/png' : name.toLowerCase().match(/\.hei[cf]$/) ? 'image/heic' : 'image/jpeg';
  form.append('file', { uri, name, type } as unknown as Blob);
  const res = await fetch(`${API_BASE}/v1/expenses/${expenseId}/receipt`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? "Couldn't upload the receipt.");
}
