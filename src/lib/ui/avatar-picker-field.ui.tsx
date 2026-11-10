import { launchImageLibraryAsync } from 'expo-image-picker';
import { useState } from 'react';

import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { CameraIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';

import { Avatar } from './avatar.ui';
import { Button } from './button.ui';

type AvatarPickerFieldProps = {
  /** Used for the initials shown when there's no photo. */
  name: string;
  value: string | null;
  onChange: (uri: string | null) => void;
};

/** Large avatar that opens the photo library (square crop); "Remove" goes back to initials. */
export function AvatarPickerField({ name, value, onChange }: AvatarPickerFieldProps) {
  const [failed, setFailed] = useState(false);

  const pick = async () => {
    setFailed(false);
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        shape: 'oval',
        quality: 0.8,
      });
      if (!result.canceled) onChange(result.assets[0].uri);
    } catch {
      setFailed(true);
    }
  };

  return (
    <VStack className="items-center gap-3">
      <Pressable
        onPress={() => void pick()}
        accessibilityRole="button"
        accessibilityLabel={value ? 'Change photo' : 'Choose a photo'}
        className="data-[active=true]:opacity-80">
        <Avatar name={name} photo={value} size="lg" />
        <Box className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary">
          <Icon as={CameraIcon} size="xs" className="text-primary-foreground" />
        </Box>
      </Pressable>
      <HStack className="gap-4">
        <Button label={value ? 'Change photo' : 'Add a photo'} variant="link" onPress={() => void pick()} />
        {value ? (
          <Button label="Remove" variant="link" color="muted" onPress={() => onChange(null)} />
        ) : null}
      </HStack>
      {failed ? <Text className="text-sm text-destructive">Could not open your photos. Please try again.</Text> : null}
    </VStack>
  );
}
