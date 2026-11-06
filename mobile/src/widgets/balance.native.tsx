import { Platform } from 'react-native';
import { Button, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, minimumScaleFactor, monospacedDigit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { Household } from '@/lib/api';
import { balanceWidgetProps, type BalanceWidgetProps } from '@/widgets/balance-model';

/**
 * Home screen widget. Small: the one number. Medium: the number plus Add.
 * Tapping opens the balance; Add opens the keypad. The app pushes a fresh
 * snapshot every time Home loads (widgets never call the network).
 */
const BalanceWidget = createWidget<BalanceWidgetProps>(
  'BalanceWidget',
  (props: BalanceWidgetProps, env: WidgetEnvironment) => {
    'widget';
    const color = props.tone === 'owed' ? '#3A7457' : props.tone === 'owe' ? '#B4472A' : '#241A23';
    const number = (
      <VStack alignment="leading" spacing={4}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#685A66')]}>{props.headline}</Text>
        <Text modifiers={[font({ size: 30, weight: 'bold' }), monospacedDigit(), minimumScaleFactor(0.5), foregroundStyle(color)]}>{props.amount}</Text>
        <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#685A66')]}>{props.home}</Text>
      </VStack>
    );
    if (env.widgetFamily === 'systemMedium') {
      return (
        <HStack modifiers={[containerBackground('#F6F2F4', 'widget'), padding({ all: 4 }), widgetURL('tabitat://home')]}>
          {number}
          <Spacer />
          <Button target="add" modifiers={[widgetURL('tabitat://add')]}>
            <Text modifiers={[font({ size: 16, weight: 'heavy' }), foregroundStyle('#FFFFFF')]}>+ Add</Text>
          </Button>
        </HStack>
      );
    }
    return <VStack alignment="leading" modifiers={[containerBackground('#F6F2F4', 'widget'), widgetURL('tabitat://home')]}>{number}<Spacer /></VStack>;
  },
  { headline: 'Open Gloslate', amount: '$0.00', home: '', tone: 'even' },
);

export function updateBalanceWidget(home: Household) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    BalanceWidget.updateSnapshot(balanceWidgetProps(home));
  } catch {
    // Not available in Expo Go or before the widget extension is built.
  }
}
