import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

/** Layout widths: phones stay as designed; tablet and desktop get the wide layouts. */
const breakpoints = { tablet: 600, desktop: 1024 } as const;

/** Max content width for wide layouts, so lines and grids don't stretch across big screens. */
export const contentMaxWidth = 1160;

function breakpointFor(width: number): Breakpoint {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'phone';
}

/** Width-based, not platform-based: a phone-width web window gets the phone layout too. */
export function useBreakpoint(): Breakpoint {
  return breakpointFor(useWindowDimensions().width);
}
