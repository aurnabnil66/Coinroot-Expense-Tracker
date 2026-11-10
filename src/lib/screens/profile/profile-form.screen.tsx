import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useAuth, useProfile } from '@/lib/hooks';
import { NICKNAME_MAX, type ProfileFormInput, type ProfileFormValues, profileFormSchema } from '@/lib/schemas';
import { saveProfile } from '@/lib/storage';
import { AvatarPickerField, Button, ModalHeader, ScreenContainer, TextField } from '@/lib/ui';
import { formatBdPhone } from '@/lib/utils';

/** Create or edit the profile from the app (header avatar or Settings). */
export function ProfileFormScreen() {
  const profile = useProfile();
  return (
    <View className="flex-1 bg-background">
      <ModalHeader title={profile.nickname ? 'Edit profile' : 'Create profile'} onClose={() => router.back()} />
      <ScreenContainer>
        <VStack className="pt-6">
          <ProfileForm submitLabel="Save" onDone={() => router.back()} />
        </VStack>
      </ScreenContainer>
    </View>
  );
}

type ProfileFormProps = {
  submitLabel: string;
  onDone: () => void;
};

/**
 * Photo, nickname (required, one word), email and phone (optional). With an account the
 * email is the sign-in email and can't be changed here. Also used by first-time setup.
 */
export function ProfileForm({ submitLabel, onDone }: ProfileFormProps) {
  const profile = useProfile();
  const session = useAuth();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      nickname: profile.nickname,
      photo: profile.photo,
      email: session?.email ?? profile.email,
      phone: profile.phone ? formatBdPhone(profile.phone) : '',
    },
    mode: 'onTouched',
  });
  const nickname = useWatch({ control, name: 'nickname' });

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await saveProfile({ ...values, email: session?.email ?? values.email });
      onDone();
    } catch {
      setError('root', { message: 'Could not save your profile. Please try again.' });
    }
  };

  return (
    <VStack className="gap-5">
      <Controller
        control={control}
        name="photo"
        render={({ field }) => <AvatarPickerField name={nickname} value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="nickname"
        render={({ field, fieldState }) => (
          <TextField
            label="Nickname"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            hint={`One word, up to ${NICKNAME_MAX} letters. We'll greet you with it.`}
            placeholder="What should we call you?"
            maxLength={NICKNAME_MAX}
            type="nickname"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={session ? 'Email' : 'Email (optional)'}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            hint={session ? 'Your sign-in email' : undefined}
            placeholder="name@example.com"
            type="email"
            readOnly={Boolean(session)}
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <TextField
            label="Phone (optional)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder="01XXXXXXXXX"
            type="phone"
            maxLength={16}
          />
        )}
      />
      {errors.root ? <Text className="text-sm text-destructive">{errors.root.message}</Text> : null}
      <Button label={submitLabel} size="lg" className="mt-2" loading={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </VStack>
  );
}
