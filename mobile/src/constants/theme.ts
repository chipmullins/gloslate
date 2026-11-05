/**
 * Tabitat design tokens (Plum & Sage, Nov 2026; layout from design canvas v3). Mirrors api/app/assets/stylesheets/tokens.css.
 * Money always renders in the mono family; UI text in Manrope.
 */
export const HT = {
  color: {
    ground: '#F6F2F4',
    surface: '#FFFFFF',
    ink: '#241A23',
    muted: '#685A66',
    faint: '#8C7E8A',
    brand: '#6B3A63',
    brandDeep: '#552D4F',
    brandTint: '#EFE3EC',
    onBrandMuted: '#E6D5E2',
    owedToYou: '#3A7457',
    owedTint: '#E4EFE8',
    youOwe: '#A8441C',
    hairline: '#E9E0E6',
    chipBorder: '#DCCFD8',
    segment: '#ECE4E9',
    darkCard: '#241A23',
    darkCardMuted: '#C9BAC6',
    danger: '#B42318',
    /** Accents that sit on darkCard. */
    onDarkOwed: '#A9D9BD',
    onDarkOwe: '#F2A66B',
    onDarkButton: '#3A2C39',
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
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    extrabold: 'Manrope_800ExtraBold',
    mono: 'IBMPlexMono_500Medium',
    monoBold: 'IBMPlexMono_600SemiBold',
  },
  radius: { tile: 14, button: 16, card: 24, pill: 29 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },
  minTouch: 44,
  /** Layout breakpoints (dp). >= wide: iPad, Android tablets, unfolded foldables. */
  breakpoint: { wide: 700, xwide: 1024 },
  maxWidth: { form: 520, content: 1120 },
} as const;
