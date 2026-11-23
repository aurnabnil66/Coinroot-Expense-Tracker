import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { CloseIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';

import { IconButton } from './icon-button.ui';

type ModalHeaderProps = {
  title: string;
  onClose: () => void;
  right?: ReactNode;
};

/** Close button + centred title for screens presented as modals. */
export function ModalHeader({ title, onClose, right }: ModalHeaderProps) {
  const insets = useSafeAreaInsets();
  // iOS shows modals as a sheet below the status bar; Android presents them full screen.
  const paddingTop = Platform.OS === 'ios' ? 12 : insets.top + 8;
  return (
    <HStack className="items-center gap-3 border-b border-border bg-background px-4 pb-3" style={{ paddingTop }}>
      <IconButton icon={CloseIcon} onPress={onClose} accessibilityLabel="Close" />
      <Text className="flex-1 text-center text-base font-semibold text-foreground">{title}</Text>
      <Box className="w-10 items-end">{right}</Box>
    </HStack>
  );
}
