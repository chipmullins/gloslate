/**
 * Gloslate design tokens (Plum Night, Nov 2026; layout from design canvas v3). Mirrors api/app/assets/stylesheets/tokens.css.
 * Everyday screens stay light; hero surfaces (balance card, sign-in) are a plum night sky (<NightSurface>).
 * Amber (glow) is only the glow: the logo sparkle, highlights and the primary action on night surfaces. It never means "you owe".
 * Outfit for headings, names and the wordmark; DM Sans for everything else. Money: DM Sans with tabular numbers.
 */
const LIGHT = {
    ground: '#F6F2F4',
    surface: '#FFFFFF',
    ink: '#241A23',
    muted: '#685A66',
    faint: '#776975', // placeholders: 4.6:1 on ground, 5.2:1 on white
    brand: '#6B3A63',
    brandDeep: '#552D4F',
    brandTint: '#EFE3EC',
    /** The violet accent (pill bar redesign, Nov 27): the selected tab and the main actions (Request, Pay, Add).
     *  A gradient from accent to accentDeep with white text; the same in dark mode. */
    accent: '#6E4588',
    accentDeep: '#4A2C5A',
    onAccent: '#FFFFFF',
    /** The floating tab bar's pill and its idle icons. */
    bar: '#1C1220',
    barIcon: '#D9C9DD',
    onBrandMuted: '#E6D5E2',
    owedToYou: '#3A7457',
    owedTint: '#E4EFE8',
    youOwe: '#B4472A',
    hairline: '#E9E0E6',
    chipBorder: '#DCCFD8',
    segment: '#ECE4E9',
    /** Night base. For backgrounds use <NightSurface> (the gradient sky) rather than this flat color. */
    darkCard: '#2A1A33',
    darkCardMuted: '#BBA9C4',
    danger: '#B42318',
    /** Night sky stops: radial-gradient(ellipse at 30% 0%, top 0%, base 55%, edge 100%). */
    night: { top: '#4A2C5A', base: '#2A1A33', edge: '#140C18' },
    /** Accents that sit on night surfaces. */
    onDarkText: '#F3EEF5',
    onDarkOwed: '#A9D9BD',
    /** Coral on dark. Never amber: the glow isn't a warning. */
    onDarkOwe: '#FF9E80',
    /** Glass: white at 8% over the sky (secondary buttons, dividers). */
    onDarkButton: '#FFFFFF14',
    onDarkBorder: '#FFFFFF24',
    /** Glofly's amber. Only the glow: sparkle, highlights, the primary action on night surfaces. */
    glow: '#FFB547',
    /** The wordmark's "glo" on light screens: amber that still reads on the light ground. */
    glowDeep: '#E8961F',
    glowHalo: '#FFB54755',
    onGlow: '#2A1A33',
    /** Text on a brand-filled button. */
    onBrand: '#FFFFFF',
    /** Soft amber/coral backgrounds (missing bill amount, disputed) and the error note. */
    warnTint: '#FBEBDD',
    dangerTint: '#FDECEA',
    avatar: [
      { bg: '#E6E9F7', fg: '#33427A' },
      { bg: '#E3EFE8', fg: '#2F6248' },
      { bg: '#FBEBDD', fg: '#8A3A0A' },
      { bg: '#EFE3EC', fg: '#6B3A63' },
      { bg: '#E4F1F4', fg: '#1F5B6B' },
    ],
  };
type Palette = typeof LIGHT;

/** Dark mode (canvas "Gloslate · Next round", Dark mode boards): the night sky becomes the ground.
 *  Brand plum lightens so it reads as text on night; brand-filled buttons switch to dark text. */
const DARK: Palette = {
  ...LIGHT,
  ground: '#140C18',
  surface: '#21152A',
  ink: '#F3EEF5',
  muted: '#BBA9C4',
  faint: '#9F8CA8',
  brand: '#D4A3CA',
  brandDeep: '#E6C3DE',
  brandTint: '#3A2442',
  accent: '#8A5AA6',
  accentDeep: '#4A2C5A',
  bar: '#2A1D32',
  onBrandMuted: '#5B3A55',
  owedToYou: '#A9D9BD',
  owedTint: '#1F3329',
  youOwe: '#FF9E80',
  hairline: '#2E2036',
  chipBorder: '#3F2E48',
  segment: '#2A1D32',
  danger: '#FF8A7A',
  glowDeep: '#FFB547',
  onBrand: '#241A23',
  warnTint: '#3A2420',
  dangerTint: '#3A1C1E',
  avatar: [
    { bg: '#2B2F4D', fg: '#C3CBF2' },
    { bg: '#1F3329', fg: '#A9D9BD' },
    { bg: '#3A2A1E', fg: '#F5C49A' },
    { bg: '#3A2442', fg: '#E3BEDB' },
    { bg: '#1D3238', fg: '#A6D6E2' },
  ],
};

export type Scheme = 'light' | 'dark';

export const HT = {
  /** Swapped in place by applyScheme(); screens read it while rendering, so the root remounts on a change. */
  color: { ...LIGHT } as Palette,
  scheme: 'light' as Scheme,
  /** Custom fonts don't synthesize weights on Android, so each weight is its own family. */
  font: {
    /** DM Sans: body and UI. Loaded up to 700, so extrabold maps to bold. */
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
    bold: 'DMSans_700Bold',
    extrabold: 'DMSans_700Bold',
    /** Outfit: headings, display text, names, screen titles, the wordmark. */
    display: 'Outfit_600SemiBold',
    displayBold: 'Outfit_700Bold',
    displayExtra: 'Outfit_800ExtraBold',
    /** Outfit Black: the big screen titles and hero headlines. */
    displayBlack: 'Outfit_900Black',
    /**
     * Money: DM Sans with tabular digits. DM Sans ships no `tnum` feature, so fontVariant
     * ['tabular-nums'] alone does nothing; these are DM Sans copies with fixed-width digits
     * (assets/fonts, made by scripts/tabular-font.py). Money also sets tabular-nums.
     * Key names kept from the old mono face.
     */
    mono: 'DMSansTabular_500Medium',
    monoBold: 'DMSansTabular_700Bold',
    /** IBM Plex Mono, only for tiny uppercase labels like "BY GLOFLY". */
    label: 'IBMPlexMono_500Medium',
  },
  radius: { tile: 14, button: 16, card: 24, pill: 29 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },
  minTouch: 44,
  /** Layout breakpoints (dp). >= wide: iPad, Android tablets, unfolded foldables. */
  breakpoint: { wide: 700, xwide: 1024, desktop: 1024 },
  maxWidth: { form: 520, content: 1120 } as const,
};

export function applyScheme(s: Scheme) {
  Object.assign(HT.color, s === 'dark' ? DARK : LIGHT);
  HT.scheme = s;
}

