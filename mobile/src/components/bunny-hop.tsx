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
 * Motion shared by the bunny loaders (GloBunnyLoader canvas). One hop = 0.9 s:
 * crouch (squash), launch (stretch), hang at the top, land (squash), settle.
 * Keyframes are written like the CSS mockup and eased per segment with its
 * cubic-bezier(.35, 0, .25, 1).
 */
export const HOP_MS = 900;
export const DRIFT_MS = 3600;

/** cubic-bezier(x1, y1, x2, y2) at progress x (CSS timing function). */
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

export const HOP_CURVE = [0.35, 0, 0.25, 1] as const;
export const IN_OUT_CURVE = [0.42, 0, 0.58, 1] as const;

/** Value at progress p (0..1) through keyframes `at` (ascending, 0..1) → `v`, eased per segment. */
export function keyframe(p: number, at: readonly number[], v: readonly number[], curve: readonly number[]): number {
  'worklet';
  for (let i = 1; i < at.length; i++) {
    if (p <= at[i]) {
      const span = at[i] - at[i - 1];
      const local = span > 0 ? (p - at[i - 1]) / span : 1;
      const e = bezier(local, curve[0], curve[1], curve[2], curve[3]);
      return v[i - 1] + (v[i] - v[i - 1]) * e;
    }
  }
  return v[v.length - 1];
}

/**
 * The hop forward in place, in the bunny's own (logo) units: translateX, translateY,
 * scaleX, scaleY, rotate (deg). It leans nose-up on launch (feet kick, see bunny-loader), peaks ~13 units ahead,
 * tips nose-down on landing and lands back where it started.
 */
export const HOP_AT = [0, 0.18, 0.45, 0.7, 0.82, 1];
export const HOP_X = [0, 7, 13, 9, 0, 0];
export const HOP_Y = [0, -30, -46, -10, 0, 0];
export const HOP_SX = [1.06, 0.94, 1, 0.97, 1.1, 1.06];
export const HOP_SY = [0.92, 1.08, 1, 1.04, 0.88, 0.92];
export const HOP_ROT = [0, -10, -2, 9, 0, 0];

/**
 * The logo-C bunny (from "Bunny on the slate"), in its 100-unit logo space. Its feet /
 * bottom-center pivot is (41.5, 53); the ears pivot together at (50.7, 28).
 */
export const BUNNY = {
  body: { cx: 40, cy: 43, rx: 13, ry: 10 },
  tail: { cx: 29, cy: 45, r: 4 },
  head: { cx: 50, cy: 33, r: 8 },
  ear1: { cx: 47, cy: 17, rx: 3.4, ry: 10.5, rot: -8 },
  ear2: { cx: 55, cy: 18, rx: 3.4, ry: 10, rot: 14 },
  inner1: { cx: 47, cy: 18, rx: 1.5, ry: 7, rot: -8 },
  inner2: { cx: 55, cy: 19, rx: 1.5, ry: 6.6, rot: 14 },
  eye: { cx: 53, cy: 32, r: 1.6 },
  /** Hind foot and front paw, drawn before the body. */
  foot: { cx: 35, cy: 52.6, rx: 7, ry: 2.7 },
  paw: { cx: 48.5, cy: 51.8, rx: 3.2, ry: 2.3 },
  feet: { x: 41.5, y: 53 },
  earBase: { x: 50.7, y: 28 },
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
 * The tiny single-color bunny that hops inside busy buttons (no star). Replaces the
 * spinner in `Button`'s loading state at the same 20px footprint; the hop rises above
 * the box without changing the button's size. `eye` is usually the button's fill.
 */
export function ButtonBunny({ size = 20, color, eye }: { size?: number; color: string; eye?: string }) {
  const reduce = useReducedMotion();
  const hop = useLoop(HOP_MS, reduce);
  // viewBox "16.5 5 50 50" frames the bunny (logo units); pivot at its feet.
  const VX = 16.5, VY = 5, VS = 50;
  const k = size / VS;
  const { dx, dy } = pivot((BUNNY.feet.x - VX) * k, (BUNNY.feet.y - VY) * k, size / 2, size / 2);
  const amp = k * 0.3; // a small hop: the button keeps its size
  const style = useAnimatedStyle(() => {
    if (reduce) return { transform: [] };
    const p = hop.value;
    return {
      transform: [
        { translateX: dx }, { translateY: dy },
        { translateX: keyframe(p, HOP_AT, HOP_X, HOP_CURVE) * amp },
        { translateY: keyframe(p, HOP_AT, HOP_Y, HOP_CURVE) * amp },
        { scaleX: keyframe(p, HOP_AT, HOP_SX, HOP_CURVE) },
        { scaleY: keyframe(p, HOP_AT, HOP_SY, HOP_CURVE) },
        { rotate: `${keyframe(p, HOP_AT, HOP_ROT, HOP_CURVE)}deg` },
        { translateX: -dx }, { translateY: -dy },
      ],
    };
  });
  const b = BUNNY;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox={`${VX} ${VY} ${VS} ${VS}`}>
          <Ellipse cx={b.ear1.cx} cy={b.ear1.cy} rx={b.ear1.rx + 0.6} ry={b.ear1.ry} transform={`rotate(${b.ear1.rot} ${b.ear1.cx} ${b.ear1.cy})`} fill={color} />
          <Ellipse cx={b.ear2.cx} cy={b.ear2.cy} rx={b.ear2.rx + 0.6} ry={b.ear2.ry} transform={`rotate(${b.ear2.rot} ${b.ear2.cx} ${b.ear2.cy})`} fill={color} />
          <Ellipse cx={b.foot.cx} cy={b.foot.cy} rx={b.foot.rx} ry={b.foot.ry} fill={color} />
          <Ellipse cx={b.paw.cx} cy={b.paw.cy} rx={b.paw.rx} ry={b.paw.ry} fill={color} />
          <Ellipse cx={b.body.cx} cy={b.body.cy} rx={b.body.rx} ry={b.body.ry} fill={color} />
          <Circle cx={b.tail.cx} cy={b.tail.cy} r={b.tail.r} fill={color} />
          <Circle cx={b.head.cx} cy={b.head.cy} r={b.head.r} fill={color} />
          {eye ? <Circle cx={b.eye.cx} cy={b.eye.cy} r={b.eye.r + 0.4} fill={eye} /> : null}
        </Svg>
      </Animated.View>
    </View>
  );
}
