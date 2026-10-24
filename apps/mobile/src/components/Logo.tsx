import { Image } from 'react-native';

import { he } from '@/i18n/he';

/** The Yallist lockup (orange Check-Y + "allist"), final artwork: only its height is ours. */
export function Logo({ height = 64 }: { height?: number }) {
  return (
    <Image
      source={require('../../assets/images/lockup.png')}
      style={{ height, width: (height * 224) / 64 }}
      accessibilityRole="image"
      accessibilityLabel={he.appName}
    />
  );
}
