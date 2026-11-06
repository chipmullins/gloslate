import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import type { Household } from '@/lib/api';
import { balanceWidgetProps, type BalanceWidgetProps } from '@/widgets/balance-model';

/** Android home screen widget: the one number. Tapping opens Gloslate. */
const BalanceWidget = createWidget<BalanceWidgetProps>(
  'BalanceWidget',
  (props: BalanceWidgetProps) => {
    'widget';
    const color = props.tone === 'owed' ? '#3A7457' : props.tone === 'owe' ? '#B4472A' : '#241A23';
    return (
      <Column modifiers={[fillMaxSize(), background('#F6F2F4'), paddingAll(14)]}>
        <Text color="#685A66" style={{ fontSize: 13, fontWeight: '600' }}>{props.headline}</Text>
        <Text color={color} style={{ fontSize: 28, fontWeight: '700' }}>{props.amount}</Text>
        <Text color="#685A66" style={{ fontSize: 11 }}>{props.home}</Text>
      </Column>
    );
  },
  { headline: 'Open Gloslate', amount: '$0.00', home: '', tone: 'even' },
);

export function updateBalanceWidget(home: Household) {
  try {
    BalanceWidget.updateSnapshot(balanceWidgetProps(home));
  } catch {
    // Not available in Expo Go or before the widget is built.
  }
}
