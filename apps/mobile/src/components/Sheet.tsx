import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassStyle } from './GlassTabBar';
import { Icon } from './Icon';

import { he } from '@/i18n/he';
import { colors, fonts, radius } from '@/theme';

const TITLE_ID = 'sheet-title';

/** Web-only dialog semantics; react-native-web forwards these to the DOM. */
const dialogProps =
  Platform.OS === 'web'
    ? ({ role: 'dialog', 'aria-modal': true, 'aria-labelledby': TITLE_ID } as object)
    : { accessibilityViewIsModal: true };

/**
 * Floating glass sheet with a grabber, inset 8 from the screen edges. Rendered by modal routes
 * (`presentation: 'transparentModal'`) over a scrim; `footer` stays pinned at the bottom.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  top = 64,
  titleSize = 30,
  gap = 20,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  top?: number;
  titleSize?: number;
  gap?: number;
}) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <View style={styles.root}>
      {/* Pointer-only dismiss; the close button is the accessible way out. */}
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web' ? ({ tabIndex: -1, 'aria-hidden': true } as object) : {})}
      />
      <View
        style={[styles.frame, { top: top + insets.top, bottom: 8 + insets.bottom }]}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, glassStyle]} {...dialogProps}>
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>
          {/* Pinned: only the body scrolls, so the title and X stay in reach. */}
          <View style={[styles.header, !subtitle && { alignItems: 'center' }]}>
            <View style={styles.titles}>
              <Text
                nativeID={TITLE_ID}
                style={[styles.title, { fontSize: titleSize, lineHeight: titleSize + 4 }]}
                accessibilityRole="header"
              >
                {title}
              </Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={he.close}
              onPress={onClose}
              style={styles.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[styles.body, { gap, paddingTop: gap }]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {children}
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  // Centers the sheet on wide (web) screens; absolute insets alone would pin it to one side.
  frame: { position: 'absolute', start: 8, end: 8, alignItems: 'center' },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 20px 50px rgba(14,23,38,0.25)',
    overflow: 'hidden',
  },
  grabberRow: { alignItems: 'center', paddingTop: 10 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(14,23,38,0.18)' },
  body: { paddingHorizontal: 20, paddingBottom: 20 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titles: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.displayBold, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSecondary },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(14,23,38,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 4 },
});
