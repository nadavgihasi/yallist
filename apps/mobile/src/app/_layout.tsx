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

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader } from '@/components/Loader';
import { Toast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { withSentry } from '@/lib/sentry';
import { StoreProvider } from '@/state/store';
import { colors, isRTL, webDir } from '@/theme';

// A crash in a screen replaces just that screen, so "try again" keeps where you were (this
// layout's own boundary would remount the navigator, back to its first screen); the export
// catches the rest, layouts included.
export const unstable_settings = { screenErrorBoundary: ErrorBoundary };
export { ErrorBoundary };

if (Platform.OS !== 'web') {
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

void SplashScreen.preventAutoHideAsync();

export default withSentry(RootLayout);

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_700Bold,
    Rubik_800ExtraBold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Android keeps the splash screen up meanwhile; web shows the Loader.
  if (!ready) return <Loader line={he.states.boot} />;

  return (
    <>
      <StatusBar style="dark" />
      <StoreProvider>
        <View style={styles.root} {...webDir}>
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
