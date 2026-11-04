import { ActivityIndicator } from 'react-native';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';

type LoadingStateProps = {
  label?: string;
};

/** Centred spinner for a screen or section that is still loading. */
export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  const colors = useGluestackColors();
  return (
    <VStack className="items-center gap-3 px-6 py-16" accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </VStack>
  );
}
