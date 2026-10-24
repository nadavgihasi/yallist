import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  useFonts,
} from '@expo-google-fonts/rubik';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager, Platform, StyleSheet, View } from 'react-native';

import { Toast } from '@/components/Toast';
import { StoreProvider } from '@/state/store';
import { colors } from '@/theme';

if (Platform.OS !== 'web') {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync();

/** react-native-web resolves start/end styles from the nearest `dir`, not from `<html dir>`. */
const webRtl = Platform.OS === 'web' ? ({ dir: 'rtl' } as object) : {};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <StoreProvider>
        <View style={styles.frame} {...webRtl}>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}
          />
          <Toast />
        </View>
      </StoreProvider>
    </>
  );
}

/** On wide screens (web), keep the app in a phone-width column. */
const styles = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
});
