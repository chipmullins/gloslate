import { useId, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  BUNNY, DRIFT_MS, EASE_IN_OUT, HOP_AT, HOP_CURVES, HOP_MS, HOP_ROT, HOP_SX, HOP_SY, HOP_X, HOP_Y, keyframe, pivot,
  TEASE_CURVE, useLoop,
} from '@/components/bunny-hop';
import { NightSurface } from '@/components/ui';
import { HT } from '@/constants/theme';

export { ButtonBunny } from '@/components/bunny-hop';

/** The loader's drawing space (GloBunnyLoader canvas): viewBox "0 -40 130 155". */
const VB = { x: 0, y: -40, w: 130, h: 155 };
const VIEWBOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
/** The logo bunny sits in that space at translate(-4 20) scale(1.6). */
const PLACE = { x: -4, y: 20, s: 1.6 };
const PLACE_T = `translate(${PLACE.x} ${PLACE.y}) scale(${PLACE.s})`;
const out = (p: { x: number; y: number }) => ({ x: PLACE.x + p.x * PLACE.s, y: PLACE.y + p.y * PLACE.s });

// Shadow (`bl-shadow`, viewBox units): spreads on the crouch and landing, follows the bunny
// forward and shrinks/fades at the apex.
const SHADOW_AT = [0, 0.14, 0.52, 0.85, 1];
const SHADOW_X = [0, 0, 13, 0, 0];
const SHADOW_SX = [1, 1.1, 0.5, 1.12, 1];
const SHADOW_OP = [0.45, 0.5, 0.15, 0.5, 0.45];
// Ears (`bl-ear`): trail back on launch, flop forward on landing.
const EAR_AT = [0, 0.14, 0.4, 0.52, 0.76, 0.88, 1];
const EAR_ROT = [0, 8, -20, -8, 6, 14, 0];
// Hind legs (`bl-hind`, deg from the hip): folded flat forward along the ground while
// sitting, swing down-behind on push-off, come forward again to land.
const HIND_AT = [0, 0.14, 0.3, 0.52, 0.7, 0.84, 1];
const HIND_ROT = [-84, -88, 44, 34, -24, -84, -84];
// Front legs (`bl-front`, deg from the shoulder): tuck at launch, reach forward to land.
const FRONT_AT = [0, 0.14, 0.32, 0.52, 0.72, 0.84, 1];
const FRONT_ROT = [0, 8, 40, -34, -42, 0, 0];
/** The far legs run 0.04 s ahead (the mockup's negative animation-delay). */
const FAR_LEAD = 0.04;
// The star (`bl-tease`), ahead of the nose, gets bumped at the top of each hop: it pops
// forward and up, spins a quarter turn over the cycle (a 4-point star, so it loops
// seamlessly) and drifts back. The halo travels with it.
const STAR = { x: 105, y: -4 };
const TEASE_AT = [0, 0.42, 0.54, 0.78, 1];
const TEASE_X = [0, 0, 20, 11, 0];
const TEASE_Y = [0, 0, -14, -6, 0];
const TEASE_S = [1, 1, 1.2, 1.05, 1];
const TEASE_ROT = [0, 0, 70, 85, 90];
const HALO_AT = [0, 0.46, 1];
const HALO_OP = [0.65, 1, 0.65];

const TONES = {
  night: { fur: HT.color.onDarkText, farFur: '#D9CEDF', innerEar: '#E2C6D9', eye: HT.color.night.edge, shadow: '#000000', shadowOpacity: 1 },
  // Plum shadow, peaking around 35%.
  light: { fur: HT.color.brand, farFur: '#55304F', innerEar: null, eye: HT.color.ground, shadow: HT.color.brand, shadowOpacity: 0.7 },
} as const;

/**
 * The hopping bunny loader: the logo bunny crouches, pushes off with its back legs,
 * reaches forward with its front legs to land, and bumps a floating amber glow star ahead
 * of its nose, which spins up out of reach and drifts back every time. `size` is the
 * width in px (height is size × 155/130). Respects reduce motion (a still bunny with the
 * star ahead of it).
 */
export function BunnyLoader({ size = 130, tone = 'light', label = 'Loading' }: {
  size?: number; tone?: 'night' | 'light'; label?: string;
}) {
  const reduce = useReducedMotion();
  const hop = useLoop(HOP_MS, reduce);
  const drift = useLoop(DRIFT_MS, reduce);
  const haloId = `bunnyHalo${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const c = TONES[tone];
  const b = BUNNY;

  const k = size / VB.w; // px per viewBox unit
  const kb = k * PLACE.s; // px per bunny (logo) unit
  const W = size;
  const H = VB.h * k;
  /** Pivot at a viewBox point, for a full-size layer. */
  const at = (p: { x: number; y: number }) => pivot((p.x - VB.x) * k, (p.y - VB.y) * k, W / 2, H / 2);

  const bunnyPivot = at(out(b.feet));
  const earPivot = at(out(b.earBase));
  const hipNear = at(out(b.hip));
  const hipFar = at(out({ x: b.hip.x + b.farHindDx, y: b.hip.y }));
  const shoulderNear = at(out(b.shoulder));
  const shoulderFar = at(out({ x: b.shoulder.x + b.farFrontDx, y: b.shoulder.y }));
  const shadowPivot = at({ x: 56, y: 106 });
  const starPivot = at(STAR);

  const bunnyStyle = useAnimatedStyle(() => {
    if (reduce) return { transform: [] };
    const p = hop.value;
    const { dx, dy } = bunnyPivot;
    return {
      transform: [
        { translateX: dx }, { translateY: dy },
        { translateX: keyframe(p, HOP_AT, HOP_X, HOP_CURVES) * kb },
        { translateY: keyframe(p, HOP_AT, HOP_Y, HOP_CURVES) * kb },
        { rotate: `${keyframe(p, HOP_AT, HOP_ROT, HOP_CURVES)}deg` },
        { scaleX: keyframe(p, HOP_AT, HOP_SX, HOP_CURVES) },
        { scaleY: keyframe(p, HOP_AT, HOP_SY, HOP_CURVES) },
        { translateX: -dx }, { translateY: -dy },
      ],
    };
  });
  const earStyle = useAnimatedStyle(() => {
    if (reduce) return { transform: [] };
    const { dx, dy } = earPivot;
    return {
      transform: [{ translateX: dx }, { translateY: dy }, { rotate: `${keyframe(hop.value, EAR_AT, EAR_ROT, EASE_IN_OUT)}deg` },
        { translateX: -dx }, { translateY: -dy }],
    };
  });
  /**
   * A limb swinging about its hip/shoulder at progress `t`; with reduce motion it holds the
   * sitting pose (t = 0). Each style reads `hop.value` itself: on web, reanimated only
   * updates a style for shared values read directly in its own worklet.
   */
  const limb = (t: number, pv: { dx: number; dy: number }, atStops: readonly number[], rot: readonly number[], lead: number) => {
    'worklet';
    const p = reduce ? 0 : (t + lead) % 1;
    return {
      transform: [{ translateX: pv.dx }, { translateY: pv.dy },
        { rotate: `${keyframe(p, atStops, rot, EASE_IN_OUT)}deg` },
        { translateX: -pv.dx }, { translateY: -pv.dy }],
    };
  };
  const hindFarStyle = useAnimatedStyle(() => limb(hop.value, hipFar, HIND_AT, HIND_ROT, FAR_LEAD));
  const frontFarStyle = useAnimatedStyle(() => limb(hop.value, shoulderFar, FRONT_AT, FRONT_ROT, FAR_LEAD));
  const hindNearStyle = useAnimatedStyle(() => limb(hop.value, hipNear, HIND_AT, HIND_ROT, 0));
  const frontNearStyle = useAnimatedStyle(() => limb(hop.value, shoulderNear, FRONT_AT, FRONT_ROT, 0));
  const shadowStyle = useAnimatedStyle(() => {
    if (reduce) return { opacity: SHADOW_OP[0], transform: [] };
    const p = hop.value;
    const { dx, dy } = shadowPivot;
    return {
      opacity: keyframe(p, SHADOW_AT, SHADOW_OP, EASE_IN_OUT),
      transform: [{ translateX: dx }, { translateY: dy },
        { translateX: keyframe(p, SHADOW_AT, SHADOW_X, EASE_IN_OUT) * k },
        { scaleX: keyframe(p, SHADOW_AT, SHADOW_SX, EASE_IN_OUT) },
        { translateX: -dx }, { translateY: -dy }],
    };
  });
  const driftStyle = useAnimatedStyle(() => {
    if (reduce) return { transform: [] };
    // ±7 units, easing in and out both ways over 3.6 s.
    return { transform: [{ translateX: -7 * Math.cos(drift.value * Math.PI * 2) * k }] };
  });
  const starStyle = useAnimatedStyle(() => {
    if (reduce) return { transform: [] };
    const p = hop.value;
    const { dx, dy } = starPivot;
    return {
      transform: [
        { translateX: dx }, { translateY: dy },
        { translateX: keyframe(p, TEASE_AT, TEASE_X, TEASE_CURVE) * k },
        { translateY: keyframe(p, TEASE_AT, TEASE_Y, TEASE_CURVE) * k },
        { rotate: `${keyframe(p, TEASE_AT, TEASE_ROT, TEASE_CURVE)}deg` },
        { scale: keyframe(p, TEASE_AT, TEASE_S, TEASE_CURVE) },
        { translateX: -dx }, { translateY: -dy },
      ],
    };
  });
  const haloStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 0.8 : keyframe(hop.value, HALO_AT, HALO_OP, EASE_IN_OUT),
  }));

  const layer = (children: ReactNode) => (
    <Svg width={W} height={H} viewBox={VIEWBOX} style={styles.svg}>
      <G transform={PLACE_T}>{children}</G>
    </Svg>
  );
  const hindLeg = (dx: number, fill: string) => (
    <G transform={`translate(${dx} 0)`}>
      <Rect x={b.hindLeg.x} y={b.hindLeg.y} width={b.hindLeg.w} height={b.hindLeg.h} rx={b.hindLeg.rx} fill={fill} />
      <Ellipse cx={b.hindFoot.cx} cy={b.hindFoot.cy} rx={b.hindFoot.rx} ry={b.hindFoot.ry} fill={fill} />
    </G>
  );
  const frontLeg = (dx: number, fill: string) => (
    <G transform={`translate(${dx} 0)`}>
      <Rect x={b.frontLeg.x} y={b.frontLeg.y} width={b.frontLeg.w} height={b.frontLeg.h} rx={b.frontLeg.rx} fill={fill} />
      <Ellipse cx={b.frontPaw.cx} cy={b.frontPaw.cy} rx={b.frontPaw.rx} ry={b.frontPaw.ry} fill={fill} />
    </G>
  );
  const ear = (e:{ cx: number; cy: number; rx: number; ry: number; rot: number }, fill: string) => (
    <Ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} transform={`rotate(${e.rot} ${e.cx} ${e.cy})`} fill={fill} />
  );

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}
      style={{ width: W, height: H }}>
      <Animated.View pointerEvents="none" style={[styles.fill, shadowStyle]}>
        <Svg width={W} height={H} viewBox={VIEWBOX} style={styles.svg}>
          <Ellipse cx={56} cy={106} rx={24} ry={4.5} fill={c.shadow} fillOpacity={c.shadowOpacity} />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fill, driftStyle]}>
        <Animated.View style={[styles.fill, starStyle]}>
          <Animated.View style={[styles.fill, haloStyle]}>
            <Svg width={W} height={H} viewBox={VIEWBOX} style={styles.svg}>
              <Defs>
                <RadialGradient id={haloId}>
                  <Stop offset="0" stopColor={HT.color.glow} stopOpacity={0.6} />
                  <Stop offset="1" stopColor={HT.color.glow} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={STAR.x} cy={STAR.y} r={17} fill={`url(#${haloId})`} />
            </Svg>
          </Animated.View>
          <View style={styles.fill}>
            <Svg width={W} height={H} viewBox={VIEWBOX} style={styles.svg}>
              <Path d="M105 -15 Q106 -5 116 -4 Q106 -3 105 7 Q104 -3 94 -4 Q104 -5 105 -15 Z" fill={HT.color.glow} />
            </Svg>
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fill, bunnyStyle]}>
        {/* The far pair of legs, a shade darker, behind the body. */}
        <Animated.View style={[styles.fill, hindFarStyle]}>{layer(hindLeg(b.farHindDx, c.farFur))}</Animated.View>
        <Animated.View style={[styles.fill, frontFarStyle]}>{layer(frontLeg(b.farFrontDx, c.farFur))}</Animated.View>
        <Animated.View style={[styles.fill, earStyle]}>
          {layer(
            <>
              {ear(b.ear1, c.fur)}
              {c.innerEar ? ear(b.inner1, c.innerEar) : null}
              {ear(b.ear2, c.fur)}
              {c.innerEar ? ear(b.inner2, c.innerEar) : null}
            </>,
          )}
        </Animated.View>
        <View style={styles.fill}>
          {layer(
            <>
              <Ellipse cx={b.body.cx} cy={b.body.cy} rx={b.body.rx} ry={b.body.ry} fill={c.fur} />
              <Ellipse cx={b.haunch.cx} cy={b.haunch.cy} rx={b.haunch.rx} ry={b.haunch.ry} fill={c.fur} />
              <Circle cx={b.tail.cx} cy={b.tail.cy} r={b.tail.r} fill={c.fur} />
              <Circle cx={b.head.cx} cy={b.head.cy} r={b.head.r} fill={c.fur} />
              <Circle cx={b.eye.cx} cy={b.eye.cy} r={b.eye.r} fill={c.eye} />
            </>,
          )}
        </View>
        {/* The near pair, in front of the body. */}
        <Animated.View style={[styles.fill, hindNearStyle]}>{layer(hindLeg(0, c.fur))}</Animated.View>
        <Animated.View style={[styles.fill, frontNearStyle]}>{layer(frontLeg(0, c.fur))}</Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * A full-screen wait: the night sky (`tone="night"`, app start) or the light ground
 * (screens loading their data), with the bunny and a caption centered.
 */
export function FullScreenLoader({ tone = 'light', label = 'Doing the math…' }: { tone?: 'night' | 'light'; label?: string }) {
  const night = tone === 'night';
  const body = (
    <View style={styles.center}>
      <BunnyLoader tone={tone} label={label} />
      <Text maxFontSizeMultiplier={1.4} accessibilityElementsHidden importantForAccessibility="no"
        style={[styles.caption, { color: night ? HT.color.onDarkText : HT.color.ink }]}>
        {label}
      </Text>
    </View>
  );
  return night
    ? <NightSurface fireflies style={styles.screen}>{body}</NightSurface>
    : <View style={[styles.screen, { backgroundColor: HT.color.ground }]}>{body}</View>;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  svg: { overflow: 'visible' },
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  caption: { fontFamily: HT.font.display, fontSize: 20, lineHeight: 26, textAlign: 'center' },
});
