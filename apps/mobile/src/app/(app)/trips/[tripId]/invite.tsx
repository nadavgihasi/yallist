import { useLocalSearchParams } from 'expo-router';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { invitePayload } from '@/lib/invite';
import { inviteMessage } from '@/lib/share';
import { testId } from '@/lib/testId';
import { tripInviteUrl } from '@/lib/tripInviteUrl';
import { useTrip } from '@/state/trips';
import { colors, radius, space, type } from '@/theme';

/** Copies where the browser can (web); false where it can't. */
async function copy(text: string) {
  if (!navigator.clipboard) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

/**
 * The invite sheet, where every "invite friends" button leads: the exact message that will be
 * shared, its link inside, then a button to share it. Where the browser can't share, it copies
 * the message instead; the link alone can be copied too.
 */
export default function Invite() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const data = useTrip(tripId);
  if (!data) return null;

  const link = tripInviteUrl(data.inviteToken);
  const message = inviteMessage(data.trip, link);

  const share = async () => {
    try {
      await Share.share(invitePayload(message));
    } catch (e) {
      // Closing the share sheet isn't a failure: don't copy behind the user's back.
      if (e instanceof Error && e.name === 'AbortError') return;
      if (await copy(message).catch(() => false)) showToast(he.invite.messageCopied);
    }
  };
  const copyLink = async () => {
    if (await copy(link).catch(() => false)) showToast(he.people.copied);
  };

  return (
    <Sheet
      title={he.invite.title}
      subtitle={he.invite.subtitle}
      onClose={close}
      footer={
        <View style={styles.footer}>
          <PillButton
            label={he.invite.send}
            size="lg"
            wide
            icon={<Icon name="userPlus" size={18} color={colors.onPrimary} />}
            {...testId('invite-share')}
            onPress={() => void share()}
          />
          {Platform.OS === 'web' && (
            <PillButton
              label={he.invite.copyLink}
              variant="quiet"
              wide
              {...testId('invite-copy-link')}
              onPress={() => void copyLink()}
            />
          )}
        </View>
      }
    >
      {/* The message as it will arrive: a chat bubble, selectable to copy by hand. */}
      <View style={styles.bubble}>
        <Text style={styles.message} selectable {...testId('invite-message')}>
          {message}
        </Text>
      </View>
      <Text style={styles.link} selectable numberOfLines={1} {...testId('invite-link')}>
        {link}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space[2] },
  bubble: {
    alignSelf: 'stretch',
    padding: space[4],
    borderRadius: radius.card,
    borderTopStartRadius: space[1],
    backgroundColor: colors.primaryTint,
  },
  message: { ...type.body, color: colors.ink, writingDirection: 'rtl' },
  link: { ...type.caption, color: colors.inkMuted, textAlign: 'center', writingDirection: 'ltr' },
});
