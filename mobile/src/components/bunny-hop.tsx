import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse } from 'react-native-svg';

/**
 * Motion shared by the bunny loaders (GloBunnyLoader canvas). One hop = 1 s, every part
 * driven by one looping 0→1 progress so they stay in sync. Keyframes are written like the
 * CSS mockup; each segment has its own CSS timing function.
 */
export const HOP_MS = 1000;
export const DRIFT_MS = 3600;

type Curve = readonly [number, number, number, number];
export const LINEAR: Curve = [0, 0, 1, 1];
export const EASE_OUT: Curve = [0, 0, 0.58, 1];
export const EASE_IN_OUT: Curve = [0.42, 0, 0.58, 1];
export const TEASE_CURVE: Curve = [0.35, 0, 0.25, 1];

/** cubic-bezier(x1, y1, x2, y2) at progress x (a CSS timing function). */
export function bezier(x: number, x1: number, y1: number, x2: number, y2: number): number {
  'worklet';
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = ((ax * t + bx) * t + cx) * t - x;
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  t = Math.min(1, Math.max(0, t));
  return ((ay * t + by) * t + cy) * t;
}

/**
 * Value at progress p (0..1) through keyframes `at` (ascending, 0..1) → `v`. `curve` is
 * one timing function for every segment, or a list with one per segment (like CSS
 * animation-timing-function set inside each keyframe).
 */
export function keyframe(p: number, at: readonly number[], v: readonly number[], curve: Curve | readonly Curve[]): number {
  'worklet';
  for (let i = 1; i < at.length; i++) {
    if (p <= at[i]) {
      const span = at[i] - at[i - 1];
      const local = span > 0 ? (p - at[i - 1]) / span : 1;
      const c = (typeof curve[0] === 'number' ? curve : (curve as readonly Curve[])[i - 1]) as Curve;
      const e = bezier(local, c[0], c[1], c[2], c[3]);
      return v[i - 1] + (v[i] - v[i - 1]) * e;
    }
  }
  return v[v.length - 1];
}

/**
 * The hop (`bl-hop`), in the bunny's own (logo) units: crouch at 14%, launch nose-up at
 * 36%, apex ~13 ahead at 52% (stretched long and level), fall nose-down at 76%, squash
 * on landing at 86%, then settle back where it started.
 */
export const HOP_AT = [0, 0.14, 0.36, 0.52, 0.76, 0.86, 1];
export const HOP_X = [0, -1, 9, 13, 6, 0, 0];
export const HOP_Y = [0, 2, -38, -46, -5, 1, 0];
export const HOP_ROT = [0, 4, -10, 0, 9, 2, 0];
export const HOP_SX = [1, 1.08, 1.04, 1.12, 1, 1.1, 1];
export const HOP_SY = [1, 0.88, 0.98, 0.93, 1.02, 0.88, 1];
export const HOP_CURVES: readonly Curve[] = [EASE_OUT, [0.15, 0.75, 0.35, 1], EASE_IN_OUT, [0.55, 0, 0.85, 0.45], EASE_OUT, EASE_OUT];

/**
 * The logo-C bunny ("Bunny on the slate") with legs for the loader, in its 100-unit logo
 * space. Legs are limbs that swing from the hip / shoulder; pivots are the mockup's
 * transform-origins worked out on each limb's box.
 */
export const BUNNY = {
  body: { cx: 40, cy: 43, rx: 13, ry: 10 },
  haunch: { cx: 34.5, cy: 46, rx: 8.5, ry: 7 },
  tail: { cx: 28.5, cy: 44.5, r: 4 },
  head: { cx: 50, cy: 33, r: 8 },
  ear1: { cx: 47, cy: 17, rx: 3.4, ry: 10.5, rot: -8 },
  ear2: { cx: 55, cy: 18, rx: 3.4, ry: 10, rot: 14 },
  inner1: { cx: 47, cy: 18, rx: 1.5, ry: 7, rot: -8 },
  inner2: { cx: 55, cy: 19, rx: 1.5, ry: 6.6, rot: 14 },
  eye: { cx: 53, cy: 32, r: 1.6 },
  /** Hind leg: thigh + long foot, swinging from the hip (50% 12% of its box). */
  hindLeg: { x: 31.3, y: 44, w: 5.6, h: 14.6, rx: 2.8 },
  hindFoot: { cx: 34.1, cy: 58, rx: 3, ry: 4.2 },
  hip: { x: 34.1, y: 46.2 },
  /** Front leg + paw, swinging from the shoulder (50% 10% of its box). */
  frontLeg: { x: 46, y: 44, w: 4.6, h: 10, rx: 2.3 },
  frontPaw: { cx: 48.6, cy: 53.4, rx: 3, ry: 2.2 },
  shoulder: { x: 48.6, y: 45.2 },
  /** The far pair sits a little apart from the near pair. */
  farHindDx: 2.5,
  farFrontDx: -2.2,
  /** Where the bunny meets the ground (the hop's origin). */
  feet: { x: 41.25, y: 55 },
  /** Bottom center of both ears. */
  earBase: { x: 51.4, y: 27.7 },
} as const;

/**
 * Transforms that pivot around (ox, oy) px inside a box whose default origin is its
 * center (cx, cy). RN and web both honour plain translate/scale/rotate arrays, so this
 * avoids relying on transformOrigin.
 */
export function pivot(ox: number, oy: number, cx: number, cy: number) {
  'worklet';
  return { dx: ox - cx, dy: oy - cy };
}

/** A 0→1 progress that loops forever (or stays at 0 when `still`). */
export function useLoop(ms: number, still: boolean): SharedValue<number> {
  const p = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, [ms, still, p]);
  return p;
}

/**
 * The tiny single-color bunny that hops inside busy buttons (no star, and no legs: they
 * don't read at 20px; the body hop carries it). Replaces the
 * spinner in `Button`'s loading state at the same 20px footprint; the hop rises above
 * the box without changing the button's size. `eye` is usually the button's fill.
 */
export function ButtonBunny({ size = 20, color, eye }: { size?: number; color: string; eye?: string }) {
  const reduce = useReducedMotion();
  const hop = useLoop(HOP_MS, reduce);
  // viewBox frames the bunny (logo units); the hop pivots at its feet.
  const VX = 15.75, VY = 5.5, VS = 51;
  const k = size / VS;
  const { dx, dy } = pivot((BUNNY.feet.x - VX) * k, (BUNNY.feet.y - VY) * k, size / 2, size / 2);
  const amp = k * 0.3; // a small hop: the button keeps its size
  const style = useAnimatedStyle(() => {
    if (reduce) return { transform: [] };
    const p = hop.value;
    return {
      transform: [
        { translateX: dx }, { translateY: dy },
        { translateX: keyframe(p, HOP_AT, HOP_X, HOP_CURVES) * amp },
        { translateY: keyframe(p, HOP_AT, HOP_Y, HOP_CURVES) * amp },
        { rotate: `${keyframe(p, HOP_AT, HOP_ROT, HOP_CURVES)}deg` },
        { scaleX: keyframe(p, HOP_AT, HOP_SX, HOP_CURVES) },
        { scaleY: keyframe(p, HOP_AT, HOP_SY, HOP_CURVES) },
        { translateX: -dx }, { translateY: -dy },
      ],
    };
  });
  const b = BUNNY;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox={`${VX} ${VY} ${VS} ${VS}`}>
          <Ellipse cx={b.ear1.cx} cy={b.ear1.cy} rx={b.ear1.rx} ry={b.ear1.ry} transform={`rotate(${b.ear1.rot} ${b.ear1.cx} ${b.ear1.cy})`} fill={color} />
          <Ellipse cx={b.ear2.cx} cy={b.ear2.cy} rx={b.ear2.rx} ry={b.ear2.ry} transform={`rotate(${b.ear2.rot} ${b.ear2.cx} ${b.ear2.cy})`} fill={color} />
          <Ellipse cx={b.body.cx} cy={b.body.cy} rx={b.body.rx} ry={b.body.ry} fill={color} />
          <Ellipse cx={b.haunch.cx} cy={b.haunch.cy} rx={b.haunch.rx} ry={b.haunch.ry} fill={color} />
          <Circle cx={b.tail.cx} cy={b.tail.cy} r={b.tail.r} fill={color} />
          <Circle cx={b.head.cx} cy={b.head.cy} r={b.head.r} fill={color} />
          {eye ? <Circle cx={b.eye.cx} cy={b.eye.cy} r={b.eye.r} fill={eye} /> : null}
        </Svg>
      </Animated.View>
    </View>
  );
}
