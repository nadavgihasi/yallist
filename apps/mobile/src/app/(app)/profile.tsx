import { AVATAR_COLORS, formatIsraeliMobile, parseIsraeliMobile } from '@yallist/domain';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Switch } from '@/components/Controls';
import { TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Card, ListGroup } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { VersionLine } from '@/components/VersionLine';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { initial } from '@/features/trip/derive';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { signInWithGoogle } from '@/lib/api';
import { useProfile, useUpdateProfile, type Profile } from '@/state/profile';
import { useSession } from '@/state/store';
import { colors, layout, radius, size, space, type } from '@/theme';
import { useBreakpoint, type Breakpoint } from '@/theme/breakpoint';

const NOTIFY_PREFS = ['notifyUpdates', 'notifyDayBefore', 'notifySettle'] as const;

/** react-native-web adds these to Pressable's state. */
type WebState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

/** Keeps the desktop profile column in view while the settings scroll (web only). */
const sticky = (Platform.OS === 'web' ? { position: 'sticky', top: 24 } : {}) as ViewStyle;

/**
 * The user's profile and settings: cards of rows, one per section. A new setting is a row in
 * its section's card (`SettingRow`), or a new card.
 */
export default function ProfileScreen() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  // Tablet: a wider centered column. Desktop: the profile beside the settings.
  const bp = useBreakpoint();
  const wide = bp !== 'phone';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        wide && styles.contentWide,
        bp === 'desktop' && styles.contentDesktop,
        { paddingTop: (wide ? 32 : 12) + insets.top, paddingBottom: 32 + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={he.profile.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={(state: WebState) => [
            styles.back,
            (state.hovered || state.pressed) && styles.hover,
            state.focused && styles.focus,
          ]}
        >
          <Icon name="back" strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.h1} accessibilityRole="header" {...testId('profile-title')}>
          {he.profile.title}
        </Text>
      </View>

      {profile.data ? (
        // Keyed: after linking Google it's another user, whose fields start fresh.
        <Settings key={profile.data.id} profile={profile.data} bp={bp} />
      ) : profile.isError ? (
        <Pressable onPress={() => profile.refetch()} style={styles.status}>
          <Text style={styles.caption}>{he.errors.loadFailed}</Text>
          <Text style={styles.retry}>{he.errors.retry}</Text>
        </Pressable>
      ) : (
        <ActivityIndicator color={colors.primary} style={styles.status} />
      )}
    </ScrollView>
  );
}

function Settings({ profile, bp }: { profile: Profile; bp: Breakpoint }) {
  const update = useUpdateProfile();
  const { signIn } = useSession();
  const guest = profile.account.type === 'guest';
  const [name, setName] = useState(profile.displayName);
  const [phone, setPhone] = useState(
    profile.paymentPhone ? formatIsraeliMobile(profile.paymentPhone) : '',
  );
  const [phoneError, setPhoneError] = useState(false);

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(profile.displayName);
    else if (trimmed !== profile.displayName) update.mutate({ displayName: trimmed });
  };

  const savePhone = () => {
    const parsed = phone.trim() ? parseIsraeliMobile(phone) : null;
    setPhoneError(parsed === undefined);
    if (parsed === undefined) return;
    if (parsed) setPhone(formatIsraeliMobile(parsed));
    if (parsed !== profile.paymentPhone) update.mutate({ paymentPhone: parsed });
  };

  const linkGoogle = (idToken: string) =>
    signInWithGoogle(idToken)
      .then(signIn)
      .then(() => showToast(he.profile.linked))
      .catch(() => showToast(he.errors.signIn));

  const desktop = bp === 'desktop';

  const you = (
    <>
      <Card>
        <View style={styles.identity}>
          <Avatar
            person={{ initial: initial(profile.displayName) }}
            color={profile.avatarColor}
            size={96}
            ring={false}
          />
        </View>
        <View
          style={styles.swatches}
          accessibilityRole="radiogroup"
          accessibilityLabel={he.profile.color}
        >
          {AVATAR_COLORS.map((color, i) => {
            const selected = color === profile.avatarColor;
            return (
              <Pressable
                key={color}
                accessibilityRole="radio"
                accessibilityLabel={he.profile.colorOption(i + 1)}
                accessibilityState={{ checked: selected }}
                onPress={() => selected || update.mutate({ avatarColor: color })}
                style={(state: WebState) => [
                  styles.swatch,
                  state.hovered && styles.swatchHover,
                  selected && styles.swatchOn,
                  state.focused && styles.focus,
                ]}
              >
                <View style={[styles.swatchFill, { backgroundColor: color }]} />
              </Pressable>
            );
          })}
        </View>
        <TextField
          label={he.profile.name}
          hint={he.profile.nameHint}
          value={name}
          onChangeText={setName}
          // Enter blurs the field, so this also saves on submit (once).
          onBlur={saveName}
          maxLength={50}
          returnKeyType="done"
        />
      </Card>

      <ListGroup title={he.profile.payments}>
        <TextField
          label={he.profile.phone}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setPhoneError(false);
          }}
          onBlur={savePhone}
          placeholder={he.profile.phonePlaceholder}
          inputMode="tel"
          autoComplete="tel"
          returnKeyType="done"
          // Digits read left to right even in a Hebrew screen.
          style={styles.ltr}
        />
        {phoneError ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {he.profile.phoneInvalid}
          </Text>
        ) : (
          <Text style={styles.caption}>{he.profile.phoneHint}</Text>
        )}
      </ListGroup>
    </>
  );

  const settings = (
    <>
      <ListGroup title={he.profile.account}>
        {guest ? (
          <>
            <SettingRow label={he.profile.guest} hint={he.profile.guestHint} />
            <GoogleButton onIdToken={(idToken) => void linkGoogle(idToken)} />
          </>
        ) : (
          <SettingRow label={he.profile.google} hint={profile.account.email ?? undefined} />
        )}
      </ListGroup>

      <ListGroup title={he.profile.notifications} aside={he.profile.soon}>
        {NOTIFY_PREFS.map((pref) => {
          const [label, hint] = he.profile.notify[pref];
          return (
            <SettingRow key={pref} label={label} hint={hint}>
              <Switch
                label={label}
                value={profile[pref]}
                onChange={(value) => update.mutate({ [pref]: value })}
              />
            </SettingRow>
          );
        })}
      </ListGroup>

      <ListGroup title={he.profile.feedback}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/feedback')}
          style={(state: WebState) => [
            styles.linkRow,
            (state.hovered || state.pressed) && styles.hover,
            state.focused && styles.focus,
          ]}
        >
          <SettingRow label={he.profile.suggest} hint={he.profile.suggestHint}>
            <Icon name="chevronEnd" size={20} color={colors.inkMuted} />
          </SettingRow>
        </Pressable>
      </ListGroup>

      <SignOut guest={guest} />
      <VersionLine />
    </>
  );

  return desktop ? (
    <View style={styles.columns}>
      <View style={[styles.side, sticky]}>{you}</View>
      <View style={styles.main}>{settings}</View>
    </View>
  ) : (
    <>
      {you}
      {settings}
    </>
  );
}

/** A row in a settings card: label and optional hint at the start, a control at the end. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTexts}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint && <Text style={styles.caption}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

/** Asks first; a guest is warned that signing out loses their trips. */
function SignOut({ guest }: { guest: boolean }) {
  const { signOut } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <PillButton label={he.profile.signOut} variant="danger" onPress={() => setConfirming(true)} />
    );
  }
  return (
    <Card gap={space[3]}>
      <Text style={styles.rowLabel} accessibilityRole="alert">
        {he.profile.signOutConfirm}
      </Text>
      {guest && <Text style={styles.caption}>{he.profile.signOutGuest}</Text>}
      <View style={styles.actions}>
        <PillButton
          label={he.profile.signOutYes}
          variant="soft"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            // The (app) layout then redirects to the login screen.
            void signOut();
          }}
        />
        <PillButton
          label={he.profile.cancel}
          variant="quiet"
          onPress={() => setConfirming(false)}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: {
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
    paddingHorizontal: space.screen,
    gap: space[4],
  },
  // Tablet: one column, as wide as the trip screen's.
  contentWide: { maxWidth: 640, paddingHorizontal: space[6] },
  contentDesktop: { maxWidth: 960, gap: space[6] },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space[6] },
  // Fits the seven color swatches on one row.
  side: { width: 400, gap: space[4] },
  main: { flex: 1, minWidth: 0, gap: space[4] },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  back: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hover: { opacity: 0.8 },
  // A ring for keyboard focus on web; the width matches the selected swatch's border.
  focus: { outlineColor: colors.primary, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 },
  h1: { ...type.pageTitle, color: colors.ink, flexShrink: 1 },
  status: { alignItems: 'center', gap: space[2], paddingVertical: 48 },
  retry: { ...type.buttonSm, color: colors.primary },
  identity: { alignItems: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] },
  swatch: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 3,
  },
  swatchHover: { borderColor: colors.line },
  swatchOn: { borderColor: colors.primary },
  swatchFill: { flex: 1, borderRadius: size.avatar / 2 },
  ltr: { writingDirection: 'ltr', textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  linkRow: { borderRadius: radius.input },
  rowTexts: { flex: 1, gap: space[1] },
  rowLabel: { ...type.itemTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  error: { ...type.caption, fontFamily: type.itemTitle.fontFamily, color: colors.brandStrong },
  actions: { flexDirection: 'row', gap: space[2] },
});
