import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ChevronIcon, SparkleIcon } from '@/components/icons';
import { NightSurface, T } from '@/components/ui';
import { HT } from '@/constants/theme';

/** From December through mid-January, Home offers your year recap. */
export function RecapBanner() {
  const now = new Date();
  const on = now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 15);
  if (!on) return null;
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Your ${year} on the slate`} onPress={() => router.push('/recap' as Href)}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <NightSurface style={{ borderRadius: HT.radius.tile, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SparkleIcon size={20} />
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: HT.font.displayBold, fontSize: 15.5, color: HT.color.onDarkText }}>Your {year} on the slate</T>
            <T style={{ fontFamily: HT.font.medium, fontSize: 12.5, color: HT.color.darkCardMuted }}>What you shared this year, ready to share</T>
          </View>
          <ChevronIcon size={16} color={HT.color.darkCardMuted} />
        </View>
      </NightSurface>
    </Pressable>
  );
}
