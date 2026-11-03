import { Switch } from 'react-native';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';

type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SwitchRow({ label, description, value, onValueChange }: SwitchRowProps) {
  const colors = useGluestackColors();
  return (
    <HStack className="items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Box className="flex-1">
        <Text className="text-base font-medium text-foreground">{label}</Text>
        {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
      </Box>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary }} />
    </HStack>
  );
}
