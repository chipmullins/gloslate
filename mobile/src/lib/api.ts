import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'hometab.session';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// SecureStore is native-only; web (dev preview) falls back to memory.
let memoryToken: string | null = null;
export const tokenStore = {
  async get() {
    if (Platform.OS === 'web') return memoryToken;
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string | null) {
    if (Platform.OS === 'web') {
      memoryToken = token;
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
    throw new ApiError(0, "Can't reach HomeTab. Check your connection.");
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
  first_name: string;
  placeholder: boolean;
  former: boolean;
  you: boolean;
  handles: Handles;
};

export type Balance = { net_cents: number; with: { member_id: string; cents: number }[] };

export type HouseholdSummary = { id: string; name: string; member_count: number; balance: Balance };

export type Household = HouseholdSummary & {
  me: Member;
  members: Member[];
  simplify_debts: boolean;
  statement_day: number;
};

export type User = {
  id: string;
  first_name: string;
  email: string | null;
  phone: string | null;
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
