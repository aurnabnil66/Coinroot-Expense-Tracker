import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { GluestackUIProvider, useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { useColorScheme } from '@/lib/hooks';

export default function RootLayout() {
  const colorScheme = useColorScheme();
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
  };

  const pushed = {
    headerShown: true,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.foreground },
    headerStyle: { backgroundColor: colors.background },
  } as const;
  const modal = { presentation: 'modal', headerShown: false } as const;

  return (
    <GluestackUIProvider mode="system">
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transaction/[id]" options={pushed} />
          <Stack.Screen name="account/[id]" options={pushed} />
          <Stack.Screen name="categories" options={pushed} />
          <Stack.Screen name="transaction-form" options={modal} />
          <Stack.Screen name="account-form" options={modal} />
          <Stack.Screen name="category-form" options={modal} />
        </Stack>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
