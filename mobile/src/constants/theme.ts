/**
 * HomeTab design tokens (design canvas v3). Mirrors api/app/assets/stylesheets/tokens.css.
 * Money always renders in the mono family; UI text in Manrope.
 */
export const HT = {
  color: {
    ground: '#F3F4EF',
    surface: '#FFFFFF',
    ink: '#15201A',
    muted: '#56625B',
    faint: '#7A857E',
    brand: '#1C6A4C',
    brandDeep: '#15513A',
    brandTint: '#E3EFE8',
    onBrandMuted: '#D2E6DB',
    owedToYou: '#1C6A4C',
    youOwe: '#B0440C',
    hairline: '#E1E4DC',
    chipBorder: '#D5D9CF',
    segment: '#E6E8E1',
    darkCard: '#15201A',
    darkCardMuted: '#B9C7BF',
    danger: '#B42318',
    avatar: [
      { bg: '#E6E9F7', fg: '#33427A' },
      { bg: '#E3EFE8', fg: '#1C6A4C' },
      { bg: '#FBEBDD', fg: '#8A3A0A' },
      { bg: '#F1E6F5', fg: '#6B2F80' },
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
