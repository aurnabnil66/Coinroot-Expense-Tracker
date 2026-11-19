import { launchImageLibraryAsync } from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { CameraIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { PhotoError, shrinkPhoto } from '@/lib/storage';
import { pickedPhotoProblem } from '@/lib/utils';

import { Avatar } from './avatar.ui';
import { Button } from './button.ui';

type AvatarPickerFieldProps = {
  /** Used for the initials shown when there's no photo. */
  name: string;
  value: string | null;
  onChange: (uri: string | null) => void;
};

/**
 * Large avatar that opens the photo library (square crop). The picked photo is checked
 * (`pickedPhotoProblem`: a JPG / PNG / WebP / HEIC photo, at most 25 MB, at least 128 px) and
 * shrunk to a 512 px JPEG (`shrinkPhoto`) before it's handed to the form, so only a small file
 * is ever saved or uploaded. "Remove" goes back to initials.
 */
export function AvatarPickerField({ name, value, onChange }: AvatarPickerFieldProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const colors = useGluestackColors();

  const pick = async () => {
    if (preparing) return;
    setProblem(null);
    let asset;
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        shape: 'oval',
        // Full quality here: the photo is compressed once, when it's shrunk.
        quality: 1,
      });
      if (result.canceled) return;
      asset = result.assets[0];
    } catch {
      setProblem('Could not open your photos. Please try again.');
      return;
    }
    const invalid = pickedPhotoProblem(asset);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setPreparing(true);
    try {
      onChange(await shrinkPhoto(asset.uri));
    } catch (e) {
      setProblem(e instanceof PhotoError ? e.message : "This photo couldn't be prepared. Try another one.");
    } finally {
      setPreparing(false);
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
        {preparing ? (
          <Box className="absolute inset-0 items-center justify-center rounded-full bg-background/70">
            <ActivityIndicator color={colors.primary} />
          </Box>
        ) : null}
        <Box className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary">
          <Icon as={CameraIcon} size="xs" className="text-primary-foreground" />
        </Box>
      </Pressable>
      <HStack className="gap-4">
        <Button
          label={preparing ? 'Preparing photo…' : value ? 'Change photo' : 'Add a photo'}
          variant="link"
          disabled={preparing}
          onPress={() => void pick()}
        />
        {value && !preparing ? (
          <Button label="Remove" variant="link" color="muted" onPress={() => onChange(null)} />
        ) : null}
      </HStack>
      {problem ? <Text className="text-center text-sm text-destructive">{problem}</Text> : null}
    </VStack>
  );
}
