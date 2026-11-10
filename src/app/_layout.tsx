import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { FontFamily } from '@/lib/constants';
import { GluestackUIProvider, useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { useColorScheme, useLedger, useThemePreference } from '@/lib/hooks';
import { DialogProvider } from '@/lib/ui';

export default function RootLayout() {
  const themePreference = useThemePreference();
  const { setupDone } = useLedger();
  const deviceScheme = useColorScheme();
  const colorScheme = themePreference === 'system' ? deviceScheme : themePreference;
  const colors = useGluestackColors();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.foreground,
      border: colors.border,
    },
    fonts: {
      regular: { fontFamily: FontFamily, fontWeight: '400' },
      medium: { fontFamily: FontFamily, fontWeight: '500' },
      bold: { fontFamily: FontFamily, fontWeight: '600' },
      heavy: { fontFamily: FontFamily, fontWeight: '700' },
    },
  } satisfies typeof base;

  const pushed = {
    headerShown: true,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.foreground, fontFamily: FontFamily, fontWeight: '600' },
    headerStyle: { backgroundColor: colors.background },
  } as const;
  const modal = { presentation: 'modal', headerShown: false } as const;

  return (
    <GluestackUIProvider mode={themePreference}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <DialogProvider>
          <Stack screenOptions={{ headerShown: false }}>
            {/* First launch shows only setup; finishing it switches to the app. */}
            <Stack.Protected guard={setupDone}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="transaction/[id]" options={pushed} />
              <Stack.Screen name="account/[id]" options={pushed} />
              <Stack.Screen name="categories" options={pushed} />
              <Stack.Screen name="transaction-form" options={modal} />
              <Stack.Screen name="account-form" options={modal} />
              <Stack.Screen name="category-form" options={modal} />
              <Stack.Screen name="balance-check" options={modal} />
              <Stack.Screen name="profile-form" options={modal} />
              <Stack.Screen name="log-in" options={modal} />
              <Stack.Screen name="sign-up" options={modal} />
            </Stack.Protected>
            <Stack.Protected guard={!setupDone}>
              <Stack.Screen name="setup" />
            </Stack.Protected>
          </Stack>
        </DialogProvider>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
