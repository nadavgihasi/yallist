import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassStyle } from './GlassTabBar';
import { Icon } from './Icon';

import { colors, fonts, radius } from '@/theme';

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
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  top?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="סגירה"
      />
      <View
        style={[styles.sheet, glassStyle, { top: top + insets.top, bottom: 8 + insets.bottom }]}
        accessibilityViewIsModal
      >
        <View style={styles.grabberRow}>
          <View style={styles.grabber} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.titles}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="סגירה"
              onPress={onClose}
              style={styles.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          {children}
        </ScrollView>
        {footer && <View style={styles.footer}>{footer}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    start: 8,
    end: 8,
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 20px 50px rgba(14,23,38,0.25)',
    overflow: 'hidden',
  },
  grabberRow: { alignItems: 'center', paddingTop: 10 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(14,23,38,0.18)' },
  body: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, gap: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titles: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 34, color: colors.ink },
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
