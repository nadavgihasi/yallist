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

import { colors } from '@/theme';

if (Platform.OS !== 'web') {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync();

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
      <View style={styles.frame}>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}
        />
      </View>
    </>
  );
}

/** On wide screens (web), keep the app in a phone-width column. */
const styles = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
});
