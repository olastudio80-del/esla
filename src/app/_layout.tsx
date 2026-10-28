import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bootstrap } from '@/features/bootstrap';
import { PrefsProvider, usePrefs } from '@/store/prefs';
import { useAppFonts } from '@/theme/fonts';
import { color } from '@/theme/tokens';

// Держим заставку, пока не загрузятся шрифты и настройки: показывать
// интерфейс системным шрифтом, а потом переверстать его — хуже, чем подождать.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <AppShell />
      </PrefsProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const fontsReady = useAppFonts();
  const { prefs, loading } = usePrefs();
  const ready = fontsReady && !loading;

  useEffect(() => {
    if (loading) return;
    bootstrap(prefs.lang, prefs.missedAfterMinutes).catch((error) =>
      console.warn('[esla] сбой запуска', error),
    );
    // Запуск выполняется один раз за сессию: язык и порог берём те,
    // что уже прочитаны с диска. Их смена перепланирует напоминания сама.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    // Роль определяет, какие вкладки человек увидит, поэтому спрашиваем
    // до первого экрана, а не после.
    if (ready && !prefs.onboarded) router.replace('/welcome');
  }, [ready, prefs.onboarded]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: color.paper }} />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.paper },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="medicine/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="voice-check" options={{ presentation: 'modal' }} />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        <Stack.Screen name="medical-card" />
      </Stack>
    </>
  );
}
