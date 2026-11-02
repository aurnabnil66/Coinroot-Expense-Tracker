import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { GluestackUIProvider } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { useColorScheme } from '@/lib/hooks';
import { AnimatedSplashOverlay } from '@/lib/ui';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GluestackUIProvider mode="system">
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
