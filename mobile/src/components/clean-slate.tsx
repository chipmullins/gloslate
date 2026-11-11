import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { BUNNY, EASE_IN_OUT, keyframe, LINEAR, pivot } from '@/components/bunny-hop';
import { HT } from '@/constants/theme';
import { formatCents } from '@/lib/money';

/**
 * The clean slate moment (canvas "Gloslate · Clean slate moment"): the bunny hops in
 * with its legs, tucks them away as it sits on the slate (the logo pose), the amount
 * is wiped off, a check is drawn and the glow star flares. One run, `SCENE_MS` long.
 * Reduce motion: the finished picture, no movement.
 */
export const SCENE_MS = 2600;
/** When the check lands (for the haptic). */
export const CHECK_AT_MS = 1750;

const VB = { w: 200, h: 170 };
/** The logo bunny sits on the slate at translate(20 -11) scale(1.6). */
const PLACE = { x: 20, y: -11, s: 1.6 };
const PLACE_T = `translate(${PLACE.x} ${PLACE.y}) scale(${PLACE.s})`;
const out = (p: { x: number; y: number }) => ({ x: PLACE.x + p.x * PLACE.s, y: PLACE.y + p.y * PLACE.s });

// Timeline (ms from the start).
const HOP = { from: 250, ms: 1100 };
const TUCK = { from: 1050, ms: 220 };
const WIPE = { from: 1200, ms: 550 };
const ERASE = { from: 1250, ms: 500 };
const CHECK = { from: 1700, ms: 350 };
const FLARE = { from: 1950, ms: 600 };

const UP = [0.33, 0.7, 0.6, 1] as const;
const POP = [0.3, 1.4, 0.5, 1] as const; // overshoots: the star flares past full size
const DOWN = [0.4, 0, 0.67, 0.3] as const;
// Two hops, each a real arc: steady sideways speed, ease out to the top, ease in down.
const HOP_X_AT = [0, 0.08, 0.4, 0.46, 0.78, 1];
const HOP_X = [-150, -150, -76, -76, 0, 0];
const HOP_Y_AT = [0, 0.08, 0.24, 0.4, 0.46, 0.62, 0.78, 1];
const HOP_Y = [0, 0, -46, 0, 0, -38, 0, 0];
const HOP_Y_CURVES = [LINEAR, UP, DOWN, LINEAR, UP, DOWN, LINEAR];
// Crouch, stretch on take-off, nose-down coming in, squash on landing.
const BODY_AT = [0, 0.06, 0.12, 0.24, 0.35, 0.4, 0.45, 0.51, 0.62, 0.73, 0.78, 0.88, 1];
const BODY_ROT = [0, 0, -8, -1, 7, 0, 0, -7, -1, 6, 0, 0, 0];
const BODY_SX = [1, 1.06, 0.95, 1, 1, 1.09, 1.05, 0.95, 1, 1, 1.1, 0.98, 1];
const BODY_SY = [1, 0.9, 1.07, 1, 1, 0.9, 0.92, 1.07, 1, 1, 0.88, 1.03, 1];
const LEG_AT = [0, 0.06, 0.13, 0.28, 0.37, 0.44, 0.51, 0.66, 0.75, 0.8, 1];
const HIND_ROT = [0, -12, 42, 16, -10, -12, 42, 16, -10, 0, 0];
const FRONT_ROT = [0, 8, -34, -10, 22, 8, -34, -10, 20, 0, 0];

const FUR = HT.color.onDarkText;
const FAR_FUR = '#CBBED3';
const SLATE = HT.color.night.edge;

/** 0..1 through a window of the timeline. */
function win(ms: number, w: { from: number; ms: number }) {
  'worklet';
  return Math.min(1, Math.max(0, (ms - w.from) / w.ms));
}

export function CleanSlateScene({ size = 260, amountCents }: { size?: number; amountCents?: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? SCENE_MS : 0);
  useEffect(() => {
    if (reduce) return;
    t.value = 0;
    t.value = withTiming(SCENE_MS, { duration: SCENE_MS, easing: Easing.linear });
  }, [reduce, t]);

  const k = size / VB.w;
  const W = size;
  const H = VB.h * k;
  const at = (p: { x: number; y: number }) => pivot(p.x * k, p.y * k, W / 2, H / 2);
  const b = BUNNY;
  const feet = at(out(b.feet));
  const hip = at(out(b.hip));
  const hipFar = at(out({ x: b.hip.x + b.farHindDx, y: b.hip.y }));
  const shoulder = at(out(b.shoulder));
  const shoulderFar = at(out({ x: b.shoulder.x + b.farFrontDx, y: b.shoulder.y }));
  const legTop = at(out({ x: 40, y: 44 }));
  const star = at({ x: 160, y: 40 });

  const hopStyle = useAnimatedStyle(() => {
    const p = win(t.value, HOP);
    return { transform: [
      { translateX: keyframe(p, HOP_X_AT, HOP_X, LINEAR) * k },
      { translateY: keyframe(p, HOP_Y_AT, HOP_Y, HOP_Y_CURVES) * k },
    ] };
  });
  const bodyStyle = useAnimatedStyle(() => {
    const p = win(t.value, HOP);
    const { dx, dy } = feet;
    return { transform: [{ translateX: dx }, { translateY: dy },
      { rotate: `${keyframe(p, BODY_AT, BODY_ROT, EASE_IN_OUT)}deg` },
      { scaleX: keyframe(p, BODY_AT, BODY_SX, EASE_IN_OUT) }, { scaleY: keyframe(p, BODY_AT, BODY_SY, EASE_IN_OUT) },
      { translateX: -dx }, { translateY: -dy }] };
  });
  // Legs while hopping; they fold up into the body as it sits (the logo has none).
  const legsStyle = useAnimatedStyle(() => {
    const q = win(t.value, TUCK);
    const { dx, dy } = legTop;
    return { opacity: 1 - q, transform: [{ translateX: dx }, { translateY: dy }, { scaleY: 1 - 0.65 * q }, { translateX: -dx }, { translateY: -dy }] };
  });
  const limb = (ms: number, pv: { dx: number; dy: number }, rot: readonly number[]) => {
    'worklet';
    const p = win(ms, HOP);
    return { transform: [{ translateX: pv.dx }, { translateY: pv.dy }, { rotate: `${keyframe(p, LEG_AT, rot, EASE_IN_OUT)}deg` },
      { translateX: -pv.dx }, { translateY: -pv.dy }] };
  };
  const hindFar = useAnimatedStyle(() => limb(t.value, hipFar, HIND_ROT));
  const frontFar = useAnimatedStyle(() => limb(t.value, shoulderFar, FRONT_ROT));
  const hindNear = useAnimatedStyle(() => limb(t.value, hip, HIND_ROT));
  const frontNear = useAnimatedStyle(() => limb(t.value, shoulder, FRONT_ROT));

  // The amount is wiped off: a soft cloth sweeps across while slate color covers the chalk.
  const eraseStyle = useAnimatedStyle(() => ({ width: win(t.value, ERASE) * 152 * k }));
  const wipeStyle = useAnimatedStyle(() => {
    const p = win(t.value, WIPE);
    return { opacity: p <= 0 || p >= 1 ? 0 : Math.min(1, Math.min(p, 1 - p) * 10), transform: [{ translateX: (-40 + 210 * p) * k }] };
  });
  // The check is drawn left to right.
  const checkStyle = useAnimatedStyle(() => ({ width: win(t.value, CHECK) * 62 * k }));
  const starStyle = useAnimatedStyle(() => {
    const p = win(t.value, FLARE);
    const s = keyframe(p, [0, 0.55, 1], [0, 1.6, 1], [POP, EASE_IN_OUT]);
    const r = keyframe(p, [0, 0.55, 1], [-40, 10, 0], EASE_IN_OUT);
    const { dx, dy } = star;
    return { opacity: p > 0 ? 1 : 0, transform: [{ translateX: dx }, { translateY: dy }, { rotate: `${r}deg` }, { scale: s }, { translateX: -dx }, { translateY: -dy }] };
  });
  const haloStyle = useAnimatedStyle(() => {
    const p = win(t.value, FLARE);
    const { dx, dy } = star;
    return { opacity: keyframe(p, [0, 0.5, 1], [0, 0.9, 0.55], EASE_IN_OUT),
      transform: [{ translateX: dx }, { translateY: dy }, { scale: keyframe(p, [0, 0.5, 1], [0.2, 2.2, 1], EASE_IN_OUT) }, { translateX: -dx }, { translateY: -dy }] };
  });

  const svg = (children: ReactNode, place = false) => (
    <Svg width={W} height={H} viewBox={`0 0 ${VB.w} ${VB.h}`} style={styles.svg}>{place ? <G transform={PLACE_T}>{children}</G> : children}</Svg>
  );
  const hindLeg = (dx: number, fill: string) => svg(
    <G transform={`translate(${dx} 0)`}>
      <Rect x={b.hindLeg.x} y={b.hindLeg.y} width={b.hindLeg.w} height={b.hindLeg.h} rx={b.hindLeg.rx} fill={fill} />
      <Ellipse cx={b.hindFoot.cx} cy={b.hindFoot.cy} rx={b.hindFoot.rx} ry={b.hindFoot.ry} fill={fill} />
    </G>, true);
  const frontLeg = (dx: number, fill: string) => svg(
    <G transform={`translate(${dx} 0)`}>
      <Rect x={b.frontLeg.x} y={b.frontLeg.y} width={b.frontLeg.w} height={b.frontLeg.h} rx={b.frontLeg.rx} fill={fill} />
      <Ellipse cx={b.frontPaw.cx} cy={b.frontPaw.cy} rx={b.frontPaw.rx} ry={b.frontPaw.ry} fill={fill} />
    </G>, true);
  const box = (x: number, y: number, w: number, h: number) => ({ position: 'absolute' as const, left: x * k, top: y * k, width: w * k, height: h * k });

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="The Gloslate bunny hops onto the slate and wipes it clean"
      style={{ width: W, height: H }}>
      {/* The slate with the amount in chalk. */}
      {svg(<>
        <Rect x={20} y={70} width={160} height={90} rx={16} fill={SLATE} stroke={FUR} strokeWidth={4} />
        {amountCents ? (
          <SvgText x={100} y={126} textAnchor="middle" fontFamily={HT.font.monoBold} fontSize={30} fill={FUR} fillOpacity={0.8}>{formatCents(amountCents)}</SvgText>
        ) : null}
      </>)}
      <View pointerEvents="none" style={[box(24, 74, 152, 82), { overflow: 'hidden', borderRadius: 12 * k }]}>
        <Animated.View style={[{ height: '100%', backgroundColor: SLATE }, eraseStyle]} />
      </View>
      <View pointerEvents="none" style={[box(22, 74, 156, 82), { overflow: 'hidden', borderRadius: 12 * k }]}>
        <Animated.View style={[{ width: 34 * k, height: '100%', borderRadius: 10 * k, backgroundColor: '#F3EEF52E' }, wipeStyle]} />
      </View>
      {/* The check, revealed left to right (a clip that widens; nothing covers the chalk). */}
      <Animated.View pointerEvents="none" style={[box(70, 92, 62, 48), { overflow: 'hidden' }, checkStyle]}>
        <View style={{ position: 'absolute', left: -70 * k, top: -92 * k, width: W, height: H }}>
          {svg(<Path d="M78 116 L94 132 L124 100" fill="none" stroke={FUR} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />)}
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fill, hopStyle]}>
        <Animated.View style={[styles.fill, bodyStyle]}>
          <Animated.View style={[styles.fill, legsStyle]}>
            <Animated.View style={[styles.fill, hindFar]}>{hindLeg(b.farHindDx, FAR_FUR)}</Animated.View>
            <Animated.View style={[styles.fill, frontFar]}>{frontLeg(b.farFrontDx, FAR_FUR)}</Animated.View>
          </Animated.View>
          <View style={styles.fill}>{svg(<>
            <Ellipse cx={b.ear1.cx} cy={b.ear1.cy} rx={b.ear1.rx} ry={b.ear1.ry} transform={`rotate(${b.ear1.rot} ${b.ear1.cx} ${b.ear1.cy})`} fill={FUR} />
            <Ellipse cx={b.ear2.cx} cy={b.ear2.cy} rx={b.ear2.rx} ry={b.ear2.ry} transform={`rotate(${b.ear2.rot} ${b.ear2.cx} ${b.ear2.cy})`} fill={FUR} />
            <Ellipse cx={b.body.cx} cy={b.body.cy} rx={b.body.rx} ry={b.body.ry} fill={FUR} />
            <Circle cx={b.tail.cx} cy={b.tail.cy} r={b.tail.r} fill={FUR} />
            <Circle cx={b.head.cx} cy={b.head.cy} r={b.head.r} fill={FUR} />
            <Circle cx={b.eye.cx} cy={b.eye.cy} r={2} fill={SLATE} />
          </>, true)}</View>
          <Animated.View style={[styles.fill, legsStyle]}>
            <View style={styles.fill}>{svg(<Ellipse cx={b.haunch.cx} cy={b.haunch.cy} rx={b.haunch.rx} ry={b.haunch.ry} fill={FUR} />, true)}</View>
            <Animated.View style={[styles.fill, hindNear]}>{hindLeg(0, FUR)}</Animated.View>
            <Animated.View style={[styles.fill, frontNear]}>{frontLeg(0, FUR)}</Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fill, haloStyle]}>
        {svg(<>
          <Defs>
            <RadialGradient id="cleanSlateHalo">
              <Stop offset="0" stopColor={HT.color.glow} stopOpacity={0.6} />
              <Stop offset="1" stopColor={HT.color.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={160} cy={40} r={24} fill="url(#cleanSlateHalo)" />
        </>)}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.fill, starStyle]}>
        {svg(<Path d="M160 22 Q161.6 38 178 40 Q161.6 42 160 58 Q158.4 42 142 40 Q158.4 38 160 22 Z" fill={HT.color.glow} />)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  svg: { position: 'absolute', left: 0, top: 0, overflow: 'visible' },
});
