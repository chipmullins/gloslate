import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

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

/**
 * The Gloslate "clean slate" mark: a little slate with a check on a plum-night tile, and
 * an amber 4-point sparkle with a soft halo at its top-right corner. (Kept under the old
 * HouseMark name so screens don't change.) `inverted` = glass tile, for night surfaces.
 * Small sizes use the heavier strokes from the brand canvas so it stays legible.
 */
export function HouseMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  const n = HT.color.night;
  const id = inverted ? 'glMarkG' : 'glMark';
  const small = size < 56;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <RadialGradient id={`${id}Sky`} cx="30%" cy="0%" r="110%" fx="30%" fy="0%">
          <Stop offset="0" stopColor={n.top} />
          <Stop offset="0.55" stopColor={n.base} />
          <Stop offset="1" stopColor={n.edge} />
        </RadialGradient>
        <RadialGradient id={`${id}Halo`}>
          <Stop offset="0" stopColor={HT.color.glow} stopOpacity={0.55} />
          <Stop offset="1" stopColor={HT.color.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {inverted ? (
        <Rect x={0.5} y={0.5} width={99} height={99} rx={22.5} fill="#FFFFFF" fillOpacity={0.05} stroke="#FFFFFF" strokeOpacity={0.12} />
      ) : (
        <Rect width={100} height={100} rx={23} fill={`url(#${id}Sky)`} />
      )}
      <Rect x={small ? 19 : 20} y={30} width={small ? 58 : 56} height={small ? 48 : 46} rx={small ? 9.5 : 9}
        fill={n.edge} stroke={HT.color.onDarkText} strokeWidth={small ? 4.5 : 3.5} />
      <Path d="M34 53 L43 62 L61 43" fill="none" stroke={HT.color.onDarkText} strokeWidth={small ? 7 : 5} strokeLinecap="round" strokeLinejoin="round" />
      {small ? null : <Circle cx={74} cy={29} r={20} fill={`url(#${id}Halo)`} />}
      <Path d={small ? 'M74 14 Q75 28 89 29 Q75 30 74 44 Q73 30 59 29 Q73 28 74 14 Z' : 'M74 16 Q75 28 87 29 Q75 30 74 42 Q73 30 61 29 Q73 28 74 16 Z'}
        fill={HT.color.glow} />
    </Svg>
  );
}

/** Gloslate's 4-point amber sparkle (the "Add" FAB icon, highlights). */
export function SparkleIcon({ size = 20, color = HT.color.glow }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M10 2 Q11 9 18 10 Q11 11 10 18 Q9 11 2 10 Q9 9 10 2 Z" fill={color} />
    </Svg>
  );
}
export const BackspaceIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M21 5H8l-6 7 6 7h13zM12 9l6 6M18 9l-6 6" />;
export const FlagIcon = (p: IconProps) => <Stroke {...p} d="M5 21V4M5 4h11l-2 4 2 4H5" />;
export const PencilIcon = (p: IconProps) => <Stroke {...p} d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />;
export const HouseIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />;
export const ActivityIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />;
export const CalendarIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 10h16M8 3v4M16 3v4" />;
export const PersonIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />;
export const BellIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4" />;
export const ChevronIcon = (p: IconProps) => <Stroke {...p} d="M9 5l7 7-7 7" />;
export const CameraIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z" />;
export const CopyIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M9 9h11v11H9zM5 15H4V4h11v1" />;
export const SearchIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5" />;
export const DownloadIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M12 4v12M7 11l5 5 5-5M5 20h14" />;
