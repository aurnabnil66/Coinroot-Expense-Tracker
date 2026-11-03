import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth } from '@/lib/constants';

type ScreenContainerProps = PropsWithChildren<{
  /** Add the status bar height on top (tab screens). */
  safeTop?: boolean;
  /** Leave room for the tab bar at the bottom. */
  tabBar?: boolean;
  /** Extra bottom space, e.g. for a floating button or a pinned footer. */
  extraBottom?: number;
  /** Wrap children in a ScrollView (turn off for screens that render their own list). */
  scroll?: boolean;
  /** Pinned above the scrolling content (e.g. the title and a summary card); only children scroll. */
  header?: ReactNode;
}>;

/** Full-screen background with the app's horizontal padding and max content width. */
export function ScreenContainer({
  children,
  safeTop = false,
  tabBar = false,
  extraBottom = 0,
  scroll = true,
  header,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = safeTop ? insets.top : 0;
  const paddingBottom = (tabBar ? insets.bottom + BottomTabInset : insets.bottom) + 24 + extraBottom;

  if (!scroll) {
    return <View className="flex-1 bg-background" style={{ paddingTop }}>{children}</View>;
  }

  const scrollView = (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: header ? 0 : paddingTop, paddingBottom, alignItems: 'center' }}
      keyboardShouldPersistTaps="handled">
      <View className="w-full px-5" style={{ maxWidth: MaxContentWidth }}>
        {children}
      </View>
    </ScrollView>
  );

  if (!header) return scrollView;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop }}>
      <View className="w-full self-center px-5 pb-1" style={{ maxWidth: MaxContentWidth }}>
        {header}
      </View>
      {scrollView}
    </View>
  );
}
