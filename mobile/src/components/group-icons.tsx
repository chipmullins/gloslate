import Svg, { Circle, Path } from 'react-native-svg';

import { HT } from '@/constants/theme';

type IconProps = { size?: number; color?: string };

/** Two people: the Groups tab. */
export function GroupIcon({ size = 22, color = HT.color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={9} cy={8} r={3.5} stroke={color} strokeWidth={2} />
      <Path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M15.5 4.8a3.3 3.3 0 0 1 0 6.4M17.5 14.8c2 .6 3.4 2.3 4 5.2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** An arrow between two people in a settle-up plan. */
export function ArrowIcon({ size = 16, color = HT.color.muted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M4 12h15M13 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
