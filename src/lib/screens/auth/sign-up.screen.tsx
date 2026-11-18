import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { NICKNAME_MAX, PASSWORD_MIN, type SignUpFormInput, type SignUpFormValues, signUpFormDefaults, signUpFormSchema } from '@/lib/schemas';
import { saveProfile } from '@/lib/storage';
import { AuthError, authStore } from '@/lib/supabase';
import { AvatarPickerField, Button, LinkPrompt, ModalHeader, ScreenContainer, TextField, useDialog } from '@/lib/ui';

/** "Create account" opened from Settings (after setup). */
export function SignUpScreen() {
  return (
    <View className="flex-1 bg-background">
      <ModalHeader title="Create account" onClose={() => router.back()} />
      <ScreenContainer>
        <VStack className="pt-6">
          <SignUpForm onDone={() => router.back()} onLogIn={() => router.replace('/log-in')} />
        </VStack>
      </ScreenContainer>
    </View>
  );
}

type SignUpFormProps = {
  onDone: () => void;
  onLogIn: () => void;
};

/** Nickname, email, password and optional phone; creates the account and saves the profile. */
export function SignUpForm({ onDone, onLogIn }: SignUpFormProps) {
  const dialog = useDialog();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormInput, unknown, SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: signUpFormDefaults(),
    mode: 'onTouched',
  });
  const nickname = useWatch({ control, name: 'nickname' });

  const onSubmit = async ({ password, ...profile }: SignUpFormValues) => {
    try {
      const { session } = await authStore.signUp({
        email: profile.email,
        password,
        profile: { nickname: profile.nickname, phone: profile.phone },
      });
      await saveProfile(profile);
      if (!session) {
        // The project asks for email confirmation: the emailed link finishes signing in.
        await dialog.alert({
          title: 'Check your email',
          message: `We sent a link to ${profile.email}. Open it on this phone to finish creating your account. You can keep using Coinroot meanwhile.`,
          tone: 'info',
        });
      }
    } catch (e) {
      setError('root', {
        message: e instanceof AuthError ? e.message : 'Could not create your account. Please try again.',
      });
      return;
    }
    onDone();
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
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder="name@example.com"
            type="email"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label="Password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            hint={`At least ${PASSWORD_MIN} characters, with a letter and a number`}
            type="new-password"
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
      <Button label="Create account" size="lg" className="mt-2" loading={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
      <LinkPrompt question="Already have an account?" action="Log in" onPress={onLogIn} />
    </VStack>
  );
}
