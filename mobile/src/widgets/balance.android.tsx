import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import type { Household } from '@/lib/api';
import { balanceWidgetProps, type BalanceWidgetProps } from '@/widgets/balance-model';

/** Android home screen widget: the one number. Tapping opens HomeTab. */
const BalanceWidget = createWidget<BalanceWidgetProps>(
  'BalanceWidget',
  (props: BalanceWidgetProps) => {
    'widget';
    const color = props.tone === 'owed' ? '#1C6A4C' : props.tone === 'owe' ? '#B0440C' : '#15201A';
    return (
      <Column modifiers={[fillMaxSize(), background('#F3F4EF'), paddingAll(14)]}>
        <Text color="#56625B" style={{ fontSize: 13, fontWeight: '600' }}>{props.headline}</Text>
        <Text color={color} style={{ fontSize: 28, fontWeight: '600', fontFamily: 'monospace' }}>{props.amount}</Text>
        <Text color="#56625B" style={{ fontSize: 11 }}>{props.home}</Text>
      </Column>
    );
  },
  { headline: 'Open HomeTab', amount: '$0.00', home: '', tone: 'even' },
);

export function updateBalanceWidget(home: Household) {
  try {
    BalanceWidget.updateSnapshot(balanceWidgetProps(home));
  } catch {
    // Not available in Expo Go or before the widget is built.
  }
}
