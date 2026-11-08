import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

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
/** Glofly's firefly, taken from Glofly's own logo (glofly repo `site/logo.svg`) without its tile. For "Sign in with Glofly". */
export function GloflyGlyph({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="110 120 800 800" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="gfBody" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor="#FFD24A" />
          <Stop offset="1" stopColor="#FFB000" />
        </LinearGradient>
        <LinearGradient id="gfTail" x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD21F" />
          <Stop offset="0.55" stopColor="#FF9A10" />
          <Stop offset="1" stopColor="#FF6A00" />
        </LinearGradient>
      </Defs>
      <Path d="M520 352 C524 332 520 316 506 304" fill="none" stroke="#FFB000" strokeWidth={22} strokeLinecap="round" />
      <Circle cx={505} cy={301} r={14} fill="#FFB000" />
      <Path d="M596 398 C616 380 640 374 662 382" fill="none" stroke="#FFB000" strokeWidth={22} strokeLinecap="round" />
      <Circle cx={664} cy={382} r={14} fill="#FFB000" />
      <Ellipse cx={455} cy={528} rx={78} ry={52} transform="rotate(-38 455 528)" fill="url(#gfBody)" />
      <Circle cx={540} cy={428} r={74} fill="url(#gfBody)" />
      <G fill="none" stroke="#FFA030" strokeWidth={30} strokeLinejoin="round">
        <Path d="M490 490 C420 380 268 222 182 238 C124 250 136 330 200 382 C280 444 400 470 490 490 Z" />
        <Path d="M490 490 C400 456 262 432 192 456 C142 474 150 536 222 546 C302 556 410 520 490 490 Z" />
        <Path d="M490 490 C620 500 800 520 860 580 C905 626 870 690 780 680 C680 668 572 560 490 490 Z" />
        <Path d="M490 490 C500 600 540 705 598 768 C632 804 694 796 676 736 C658 672 566 566 490 490 Z" />
      </G>
      <Rect x={282} y={588} width={216} height={154} rx={50} fill="url(#gfTail)" />
      <Path d="M322 722 L318 778 Q320 794 336 784 L392 738 Z" fill="#FF7000" />
    </Svg>
  );
}
export const TrashIcon = (p: IconProps) => <Stroke {...p} d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />;

/**
 * The Gloslate mark, "C · Bunny on the slate" (GloBunny canvas): a little off-white bunny
 * sitting on top of a slate with a check, an amber 4-point sparkle with a soft halo beside
 * it, on a plum-night tile. (Kept under the old HouseMark name so screens don't change.)
 * `inverted` = glass tile, for night surfaces. Smaller sizes use the canvas's simplified
 * drawings: under 72px the 64px one (heavier strokes, bigger eye; no tail or halo), under 48px
 * the 36px one (one ear, a plain slate).
 */
export function HouseMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  const n = HT.color.night;
  const fur = HT.color.onDarkText;
  const id = inverted ? 'glMarkG' : 'glMark';
  const tier = size < 48 ? 's' : size < 72 ? 'm' : 'l';
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
      {tier === 's' ? (
        <>
          <Rect x={14} y={52} width={72} height={38} rx={10} fill={n.edge} stroke={fur} strokeWidth={6} />
          <Ellipse cx={40} cy={44} rx={14} ry={11} fill={fur} />
          <Circle cx={51} cy={33} r={9.5} fill={fur} />
          <Ellipse cx={50} cy={15} rx={5} ry={12} transform="rotate(4 50 15)" fill={fur} />
          <Circle cx={55} cy={32} r={3.2} fill={n.edge} />
          <Path d="M80 14 Q81 28 95 29 Q81 30 80 44 Q79 30 65 29 Q79 28 80 14 Z" fill={HT.color.glow} />
        </>
      ) : tier === 'm' ? (
        <>
          <Rect x={16} y={50} width={68} height={38} rx={9} fill={n.edge} stroke={fur} strokeWidth={4.5} />
          <Path d="M36 69 L45 78 L64 59" fill="none" stroke={fur} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <Ellipse cx={40} cy={43} rx={13} ry={10} fill={fur} />
          <Circle cx={50} cy={33} r={8.5} fill={fur} />
          <Ellipse cx={47} cy={17} rx={3.8} ry={10.5} transform="rotate(-8 47 17)" fill={fur} />
          <Ellipse cx={55} cy={18} rx={3.8} ry={10} transform="rotate(14 55 18)" fill={fur} />
          <Circle cx={53.5} cy={32} r={2.5} fill={n.edge} />
          <Path d="M79 17 Q80 29 92 30 Q80 31 79 43 Q78 31 66 30 Q78 29 79 17 Z" fill={HT.color.glow} />
        </>
      ) : (
        <>
          <Rect x={16} y={50} width={68} height={38} rx={9} fill={n.edge} stroke={fur} strokeWidth={3.5} />
          <Path d="M36 69 L45 78 L64 59" fill="none" stroke={fur} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <Ellipse cx={40} cy={43} rx={13} ry={10} fill={fur} />
          <Circle cx={29} cy={45} r={4} fill={fur} />
          <Circle cx={50} cy={33} r={8} fill={fur} />
          <Ellipse cx={47} cy={17} rx={3.4} ry={10.5} transform="rotate(-8 47 17)" fill={fur} />
          <Ellipse cx={55} cy={18} rx={3.4} ry={10} transform="rotate(14 55 18)" fill={fur} />
          <Circle cx={53} cy={32} r={2} fill={n.edge} />
          <Circle cx={78} cy={30} r={16} fill={`url(#${id}Halo)`} />
          <Path d="M78 19 Q79 29 89 30 Q79 31 78 41 Q77 31 67 30 Q77 29 78 19 Z" fill={HT.color.glow} />
        </>
      )}
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
export const AddPersonIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M10 12a4 4 0 100-8 4 4 0 000 8zM2 21a8 8 0 0113.5-5.8M19 14v6M16 17h6" />;
export const PersonIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />;
export const BellIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4" />;
export const ChevronIcon = (p: IconProps) => <Stroke {...p} d="M9 5l7 7-7 7" />;
export const CameraIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z" />;
export const CopyIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M9 9h11v11H9zM5 15H4V4h11v1" />;
export const SearchIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5" />;
export const DownloadIcon = (p: IconProps) => <Stroke {...p} strokeWidth={p.strokeWidth ?? 2} d="M12 4v12M7 11l5 5 5-5M5 20h14" />;
