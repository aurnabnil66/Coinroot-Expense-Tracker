import { router } from 'expo-router';

import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { useGreeting, useProfile } from '@/lib/hooks';
import { Avatar } from '@/lib/ui';
import { formatMonthLabel, todayKey, toMonthKey } from '@/lib/utils';

/** Home header: "Good Evening, Nickname" with the month below, and the avatar opening the profile. */
export function GreetingHeader() {
  const profile = useProfile();
  const greeting = useGreeting();
  const name = profile.nickname;
  return (
    <HStack className="items-center justify-between gap-3 pb-5 pt-3">
      <Box className="flex-1">
        <Text numberOfLines={1} className="text-2xl font-semibold leading-9 text-foreground">
          {name ? `${greeting}, ${name}` : greeting}
        </Text>
        <Text className="text-sm font-medium text-primary">{formatMonthLabel(toMonthKey(todayKey()))}</Text>
      </Box>
      <Pressable
        onPress={() => router.push('/profile-form')}
        accessibilityRole="button"
        accessibilityLabel={name ? 'Edit profile' : 'Create profile'}
        className="rounded-full data-[active=true]:opacity-70">
        <Avatar name={profile.nickname} photo={profile.photo} />
      </Pressable>
    </HStack>
  );
}
