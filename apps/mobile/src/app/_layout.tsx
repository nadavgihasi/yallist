// Per weight: the package's index requires all 18 Rubik files, which would all ship in the build.
import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { Rubik_800ExtraBold } from '@expo-google-fonts/rubik/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager, Platform, StyleSheet, View } from 'react-native';

import { Toast } from '@/components/Toast';
import { StoreProvider } from '@/state/store';
import { colors, isRTL } from '@/theme';

if (Platform.OS !== 'web') {
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

void SplashScreen.preventAutoHideAsync();

/** react-native-web resolves start/end styles from the nearest `dir`, not from `<html dir>`. */
const webRtl = Platform.OS === 'web' ? ({ dir: isRTL ? 'rtl' : 'ltr' } as object) : {};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_700Bold,
    Rubik_800ExtraBold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <StoreProvider>
        <View style={styles.root} {...webRtl}>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}
          />
          <Toast />
        </View>
      </StoreProvider>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
