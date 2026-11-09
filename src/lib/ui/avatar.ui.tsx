import { Image } from 'expo-image';

import { Box } from '@/lib/gluestack-ui/box';
import { Icon, UserIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { initialsOf } from '@/lib/utils';

const SIZES = {
  sm: { box: 'h-10 w-10', text: 'text-sm', icon: 'sm' },
  md: { box: 'h-12 w-12', text: 'text-base', icon: 'md' },
  lg: { box: 'h-24 w-24', text: 'text-3xl leading-[44px]', icon: 'xl' },
} as const;

type AvatarProps = {
  name: string;
  /** Image URI; without one the initials (or a person icon when there's no name) show. */
  photo: string | null;
  size?: keyof typeof SIZES;
};

/** Round profile picture, falling back to initials on a purple tint. */
export function Avatar({ name, photo, size = 'md' }: AvatarProps) {
  const { box, text, icon } = SIZES[size];
  const initials = initialsOf(name);
  return (
    <Box className={`${box} items-center justify-center overflow-hidden rounded-full bg-primary/20 dark:bg-primary/25`}>
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : initials ? (
        <Text className={`${text} font-semibold text-primary`}>{initials}</Text>
      ) : (
        <Icon as={UserIcon} size={icon} className="text-primary" />
      )}
    </Box>
  );
}
