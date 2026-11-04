import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { VStack } from '@/lib/gluestack-ui/vstack';

import { Card } from './card.ui';

type SkeletonProps = {
  /** Size and shape, e.g. "h-4 w-24 rounded-full". */
  className?: string;
};

/** Pulsing placeholder shown where content is still loading. */
export function Skeleton({ className = '' }: SkeletonProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={animatedStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Box className={`rounded-xl bg-muted ${className}`} />
    </Animated.View>
  );
}

type SkeletonCardProps = {
  /** Number of placeholder rows. */
  rows?: number;
};

/** A card of list-row placeholders: badge, two lines of text and an amount. */
export function SkeletonCard({ rows = 3 }: SkeletonCardProps) {
  return (
    <Card accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <HStack key={index} className={`items-center gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-border' : ''}`}>
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <VStack className="flex-1 gap-2">
            <Skeleton className="h-3.5 w-3/5 rounded-full" />
            <Skeleton className="h-3 w-2/5 rounded-full" />
          </VStack>
          <Skeleton className="h-4 w-16 rounded-full" />
        </HStack>
      ))}
    </Card>
  );
}
