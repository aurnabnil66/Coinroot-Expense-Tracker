import type { ComponentProps } from 'react';

import { Box } from '@/lib/gluestack-ui/box';
import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { Text } from '@/lib/gluestack-ui/text';

type GradientCardProps = ComponentProps<typeof Box>;

/**
 * Navy → purple hero surface for the headline number on a screen.
 * Text inside should be white (`text-white`, `text-white/70`).
 */
export function GradientCard({ className = '', style, ...props }: GradientCardProps) {
  const colors = useGluestackColors();
  return (
    <Box
      className={`overflow-hidden rounded-3xl p-5 ${className}`}
      style={[
        {
          experimental_backgroundImage: `linear-gradient(135deg, ${colors.heroStart} 0%, ${colors.heroEnd} 100%)`,
          boxShadow: `0 12px 28px ${colors.heroEnd}40`,
        },
        style,
      ]}
      {...props}
    />
  );
}

type GradientStatProps = {
  label: string;
  /** Pre-rendered value, usually an `AmountText` with `tone="onHero"`. */
  children: ComponentProps<typeof Box>['children'];
};

/** Translucent tile for a secondary number inside a GradientCard. */
export function GradientStat({ label, children }: GradientStatProps) {
  return (
    <Box className="flex-1 gap-0.5 rounded-2xl bg-white/15 px-3 py-2.5">
      <Text className="text-xs font-medium text-white/75">{label}</Text>
      {children}
    </Box>
  );
}
