import type { Household } from '@/lib/api';
import { formatCents } from '@/lib/money';

export type BalanceWidgetProps = { headline: string; amount: string; home: string; tone: 'owed' | 'owe' | 'even' };

/** The one number, worded exactly like Home. */
export function balanceWidgetProps(home: Household): BalanceWidgetProps {
  const others = home.members.filter((m) => !m.you && !m.former);
  const net = home.balance.net_cents;
  const partner = others.length === 1 ? others[0] : null;
  const headline = net === 0 ? 'All square' : partner ? (net > 0 ? `${partner.first_name} owes you` : `You owe ${partner.first_name}`) : net > 0 ? "You're owed" : 'You owe';
  return { headline, amount: formatCents(Math.abs(net)), home: home.name, tone: net > 0 ? 'owed' : net < 0 ? 'owe' : 'even' };
}
