import Svg, { Path, Rect } from 'react-native-svg';

import { HT } from '@/constants/theme';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

function Stroke({ d, size = 20, color = HT.color.ink, strokeWidth = 2.2 }: IconProps & { d: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const PlusIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2.6} d="M12 5v14M5 12h14" />;
export const CloseIcon = (p: IconProps) => <Stroke {...p} d="M6 6l12 12M18 6L6 18" />;
export const BackIcon = (p: IconProps) => <Stroke {...p} d="M15 5l-7 7 7 7" />;
export const SendIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />;
export const CheckIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2.6} d="M5 12l5 5 9-10" />;
export const ShareIcon = (p: IconProps) => <Stroke {...p} d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />;
export const TrashIcon = (p: IconProps) => <Stroke {...p} d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />;

/** The receipt-house mark (logo direction A). */
export function HouseMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  const bg = inverted ? '#FFFFFF' : HT.color.brand;
  const fg = inverted ? HT.color.brand : '#FFFFFF';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no">
      <Rect width={100} height={100} rx={22.5} fill={bg} />
      <Path
        d="M27 47L50 27L73 47V77L67.25 72.5L61.5 77L55.75 72.5L50 77L44.25 72.5L38.5 77L32.75 72.5L27 77Z"
        fill={fg}
        stroke={fg}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M39 54H61M39 62H54" stroke={bg} strokeWidth={4.5} strokeLinecap="round" />
    </Svg>
  );
}
