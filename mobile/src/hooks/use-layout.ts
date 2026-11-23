import { Platform, useWindowDimensions } from 'react-native';

import { HT } from '@/constants/theme';

/**
 * One source of truth for adapting to iPhone, iPad, Android phones/tablets
 * and foldables (folded = phone, unfolded = wide). Re-renders on rotation,
 * split view / Stage Manager resizing, and fold changes.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= HT.breakpoint.wide;
  const xwide = width >= HT.breakpoint.xwide;
  const gutter = xwide ? 40 : wide ? 32 : HT.space.xl;
  // The website (app.gloslate.app) in a computer-sized window gets the top-nav dashboard layout.
  // Phones and tablets running the app never do, whatever their width.
  const desktop = Platform.OS === 'web' && width >= HT.breakpoint.desktop;
  return { width, height, wide, xwide, gutter, landscape: width > height, desktop };
}
