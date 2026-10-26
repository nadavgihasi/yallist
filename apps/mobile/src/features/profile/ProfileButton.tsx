import { router } from 'expo-router';
import { Pressable, StyleSheet, type PressableStateCallbackType } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { initial } from '@/features/trip/derive';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useProfile } from '@/state/profile';
import { useMe } from '@/state/store';
import { colors, size } from '@/theme';

/** react-native-web adds these to Pressable's state. */
type WebState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

/** The header avatar: the user's photo, or initial in their color; opens the profile. */
export function ProfileButton() {
  const me = useMe();
  const profile = useProfile().data;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={he.profile.open}
      {...testId('home-profile')}
      onPress={() => router.push('/profile')}
      style={(state: WebState) => [
        styles.button,
        (state.hovered || state.pressed) && styles.hover,
        state.focused && styles.focus,
      ]}
    >
      <Avatar
        person={{
          initial: initial(profile?.displayName ?? me.name),
          photo: profile?.avatarUrl ?? undefined,
        }}
        color={profile?.avatarColor}
        size={size.avatar}
        ring={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  hover: { opacity: 0.8 },
  focus: { borderColor: colors.primary },
});
