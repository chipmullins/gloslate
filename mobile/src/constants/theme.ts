/**
 * Gloslate design tokens (Plum Night, Nov 2026; layout from design canvas v3). Mirrors api/app/assets/stylesheets/tokens.css.
 * Everyday screens stay light; hero surfaces (balance card, sign-in) are a plum night sky (<NightSurface>).
 * Amber (glow) is only the glow: the logo sparkle, highlights and the primary action on night surfaces. It never means "you owe".
 * Outfit for headings, names and the wordmark; DM Sans for everything else. Money: DM Sans with tabular numbers.
 */
export const HT = {
  color: {
    ground: '#F6F2F4',
    surface: '#FFFFFF',
    ink: '#241A23',
    muted: '#685A66',
    faint: '#776975', // placeholders: 4.6:1 on ground, 5.2:1 on white
    brand: '#6B3A63',
    brandDeep: '#552D4F',
    brandTint: '#EFE3EC',
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
    avatar: [
      { bg: '#E6E9F7', fg: '#33427A' },
      { bg: '#E3EFE8', fg: '#2F6248' },
      { bg: '#FBEBDD', fg: '#8A3A0A' },
      { bg: '#EFE3EC', fg: '#6B3A63' },
      { bg: '#E4F1F4', fg: '#1F5B6B' },
    ],
  },
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
  breakpoint: { wide: 700, xwide: 1024 },
  maxWidth: { form: 520, content: 1120 },
} as const;
