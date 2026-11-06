import { useId, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import {
  BUNNY, DRIFT_MS, HOP_AT, HOP_CURVE, HOP_MS, HOP_ROT, HOP_SX, HOP_SY, HOP_X, HOP_Y, IN_OUT_CURVE, keyframe, pivot, useLoop,
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
const out = (x: number, y: number) => ({ x: PLACE.x + x * PLACE.s, y: PLACE.y + y * PLACE.s });

// Shadow (per hop, viewBox units): follows the bunny forward, shrinks and fades at the apex.
const SHADOW_AT = [0, 0.45, 0.82, 1];
const SHADOW_X = [0, 13, 0, 0];
const SHADOW_SX = [1, 0.55, 1, 1];
const SHADOW_OP = [0.45, 0.18, 0.45, 0.45];
// Ears flop back on launch and forward on landing.
const EAR_AT = [0, 0.18, 0.45, 0.7, 0.82, 1];
const EAR_ROT = [0, -14, -6, 8, 0, 0];
// Feet kick (bunny units / deg): tuck back on launch, reach forward to land.
const KICK_AT = [0, 0.18, 0.45, 0.7, 0.82, 1];
const KICK_X = [0, -4, -2, 2, 0, 0];
const KICK_ROT = [0, 18, 8, -10, 0, 0];
// The star, ahead of the nose, gets bumped at the top of each hop: it pops forward and
// up, spins a quarter turn over the cycle (a 4-point star, so it loops seamlessly) and
// drifts back. The halo travels with it.
const STAR = { x: 100, y: -4 };
const TEASE_AT = [0, 0.38, 0.47, 0.72, 1];
const TEASE_X = [0, 0, 14, 7, 0];
const TEASE_Y = [0, 0, -18, -9, 0];
const TEASE_S = [1, 1, 1.2, 1.05, 1];
const TEASE_ROT = [0, 0, 70, 85, 90];
const HALO_AT = [0, 0.46, 1];
const HALO_OP = [0.65, 1, 0.65];

const TONES = {
  night: { fur: HT.color.onDarkText, innerEar: '#E2C6D9', eye: HT.color.night.edge, shadow: '#000000', shadowOpacity: 1 },
  // Plum shadow peaks at 35%.
  light: { fur: HT.color.brand, innerEar: null, eye: HT.color.ground, shadow: HT.color.brand, shadowOpacity: 0.78 },
} as const;

/**
 * The hopping bunny loader: the logo bunny hops forward in place, bumping a floating
 * amber glow star ahead of its nose, which spins up out of reach and drifts back every
 * time. `size` is the width in px (height is size × 155/130). Respects reduce motion
 * (a still bunny with the star ahead of it).
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

  const bunnyPivot = at(out(b.feet.x, b.feet.y));
  const earPivot = at(out(b.earBase.x, b.earBase.y));
  const footPivot = at(out(b.foot.cx, b.foot.cy));
  const pawPivot = at(out(b.paw.cx, b.paw.cy));
  const shadowPivot = at({ x: 56, y: 106 });
  const starPivot = at(STAR);

  const bunnyStyle = useAnimatedStyle(() => {
    if (reduce) return { transform: [] };
    const p = hop.value;
    const { dx, dy } = bunnyPivot;
    return {
      transform: [
        { translateX: dx }, { translateY: dy },
        { translateX: keyframe(p, HOP_AT, HOP_X, HOP_CURVE) * kb },
        { translateY: keyframe(p, HOP_AT, HOP_Y, HOP_CURVE) * kb },
        { scaleX: keyframe(p, HOP_AT, HOP_SX, HOP_CURVE) },
        { scaleY: keyframe(p, HOP_AT, HOP_SY, HOP_CURVE) },
        { rotate: `${keyframe(p, HOP_AT, HOP_ROT, HOP_CURVE)}deg` },
        { translateX: -dx }, { translateY: -dy },
      ],
    };
  });
  const earStyle = useAnimatedStyle(() => {
    if (reduce) return { transform: [] };
    const { dx, dy } = earPivot;
    return {
      transform: [{ translateX: dx }, { translateY: dy }, { rotate: `${keyframe(hop.value, EAR_AT, EAR_ROT, IN_OUT_CURVE)}deg` },
        { translateX: -dx }, { translateY: -dy }],
    };
  });
  const kick = (pv: { dx: number; dy: number }) => {
    'worklet';
    if (reduce) return { transform: [] };
    const p = hop.value;
    return {
      transform: [{ translateX: pv.dx }, { translateY: pv.dy },
        { translateX: keyframe(p, KICK_AT, KICK_X, HOP_CURVE) * kb },
        { rotate: `${keyframe(p, KICK_AT, KICK_ROT, HOP_CURVE)}deg` },
        { translateX: -pv.dx }, { translateY: -pv.dy }],
    };
  };
  const footStyle = useAnimatedStyle(() => kick(footPivot));
  const pawStyle = useAnimatedStyle(() => kick(pawPivot));
  const shadowStyle = useAnimatedStyle(() => {
    if (reduce) return { opacity: SHADOW_OP[0], transform: [] };
    const p = hop.value;
    const { dx, dy } = shadowPivot;
    return {
      opacity: keyframe(p, SHADOW_AT, SHADOW_OP, HOP_CURVE),
      transform: [{ translateX: dx }, { translateY: dy },
        { translateX: keyframe(p, SHADOW_AT, SHADOW_X, HOP_CURVE) * k },
        { scaleX: keyframe(p, SHADOW_AT, SHADOW_SX, HOP_CURVE) },
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
        { translateX: keyframe(p, TEASE_AT, TEASE_X, HOP_CURVE) * k },
        { translateY: keyframe(p, TEASE_AT, TEASE_Y, HOP_CURVE) * k },
        { rotate: `${keyframe(p, TEASE_AT, TEASE_ROT, HOP_CURVE)}deg` },
        { scale: keyframe(p, TEASE_AT, TEASE_S, HOP_CURVE) },
        { translateX: -dx }, { translateY: -dy },
      ],
    };
  });
  const haloStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 0.8 : keyframe(hop.value, HALO_AT, HALO_OP, IN_OUT_CURVE),
  }));

  const layer = (children: ReactNode) => (
    <Svg width={W} height={H} viewBox={VIEWBOX} style={styles.svg}>{children}</Svg>
  );
  const ear = (e: { cx: number; cy: number; rx: number; ry: number; rot: number }, fill: string) => (
    <Ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} transform={`rotate(${e.rot} ${e.cx} ${e.cy})`} fill={fill} />
  );

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}
      style={{ width: W, height: H }}>
      <Animated.View pointerEvents="none" style={[styles.fill, shadowStyle]}>
        {layer(<Ellipse cx={56} cy={106} rx={24} ry={4.5} fill={c.shadow} fillOpacity={c.shadowOpacity} />)}
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fill, driftStyle]}>
        <Animated.View style={[styles.fill, starStyle]}>
          <Animated.View style={[styles.fill, haloStyle]}>
            {layer(
              <>
                <Defs>
                  <RadialGradient id={haloId}>
                    <Stop offset="0" stopColor={HT.color.glow} stopOpacity={0.6} />
                    <Stop offset="1" stopColor={HT.color.glow} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={STAR.x} cy={STAR.y} r={17} fill={`url(#${haloId})`} />
              </>,
            )}
          </Animated.View>
          <View style={styles.fill}>
            {layer(<Path d="M100 -15 Q101 -5 111 -4 Q101 -3 100 7 Q99 -3 89 -4 Q99 -5 100 -15 Z" fill={HT.color.glow} />)}
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fill, bunnyStyle]}>
        <Animated.View style={[styles.fill, earStyle]}>
          {layer(
            <G transform={PLACE_T}>
              {ear(b.ear1, c.fur)}
              {c.innerEar ? ear(b.inner1, c.innerEar) : null}
              {ear(b.ear2, c.fur)}
              {c.innerEar ? ear(b.inner2, c.innerEar) : null}
            </G>,
          )}
        </Animated.View>
        <Animated.View style={[styles.fill, footStyle]}>
          {layer(<G transform={PLACE_T}><Ellipse cx={b.foot.cx} cy={b.foot.cy} rx={b.foot.rx} ry={b.foot.ry} fill={c.fur} /></G>)}
        </Animated.View>
        <Animated.View style={[styles.fill, pawStyle]}>
          {layer(<G transform={PLACE_T}><Ellipse cx={b.paw.cx} cy={b.paw.cy} rx={b.paw.rx} ry={b.paw.ry} fill={c.fur} /></G>)}
        </Animated.View>
        <View style={styles.fill}>
          {layer(
            <G transform={PLACE_T}>
              <Ellipse cx={b.body.cx} cy={b.body.cy} rx={b.body.rx} ry={b.body.ry} fill={c.fur} />
              <Circle cx={b.tail.cx} cy={b.tail.cy} r={b.tail.r} fill={c.fur} />
              <Circle cx={b.head.cx} cy={b.head.cy} r={b.head.r} fill={c.fur} />
              <Circle cx={b.eye.cx} cy={b.eye.cy} r={b.eye.r} fill={c.eye} />
            </G>,
          )}
        </View>
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
