import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { AuthError, authStore } from '@/lib/mocks';
import { type LogInFormInput, type LogInFormValues, logInFormDefaults, logInFormSchema } from '@/lib/schemas';
import { profileSetting, saveProfile } from '@/lib/storage';
import { Button, LinkPrompt, ModalHeader, ScreenContainer, TextField, useDialog } from '@/lib/ui';

/** "Log in" opened from Settings (after setup). */
export function LogInScreen() {
  return (
    <View className="flex-1 bg-background">
      <ModalHeader title="Log in" onClose={() => router.back()} />
      <ScreenContainer>
        <VStack className="pt-6">
          <LogInForm onDone={() => router.back()} onSignUp={() => router.replace('/sign-up')} />
        </VStack>
      </ScreenContainer>
    </View>
  );
}

type LogInFormProps = {
  onDone: () => void;
  onSignUp: () => void;
};

export function LogInForm({ onDone, onSignUp }: LogInFormProps) {
  const dialog = useDialog();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LogInFormInput, unknown, LogInFormValues>({
    resolver: zodResolver(logInFormSchema),
    defaultValues: logInFormDefaults(),
    mode: 'onTouched',
  });

  const onSubmit = async (values: LogInFormValues) => {
    try {
      const session = await authStore.signIn(values);
      // The account's email becomes the profile email.
      await saveProfile({ ...profileSetting.get(), email: session.email });
      onDone();
    } catch (e) {
      setError('root', { message: e instanceof AuthError ? e.message : 'Could not log in. Please try again.' });
    }
  };

  const forgotPassword = () =>
    dialog.alert({
      title: 'Reset password',
      message: 'Password reset by email arrives when Coinroot connects to the cloud.',
      tone: 'info',
    });

  return (
    <VStack className="gap-5">
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
      <VStack className="gap-1">
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
              type="password"
            />
          )}
        />
        <Button label="Forgot password?" variant="link" className="self-end" onPress={() => void forgotPassword()} />
      </VStack>
      {errors.root ? <Text className="text-sm text-destructive">{errors.root.message}</Text> : null}
      <Button label="Log in" size="lg" loading={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
      <LinkPrompt question="New to Coinroot?" action="Create account" onPress={onSignUp} />
      <Text className="text-center text-xs text-muted-foreground">
        Prototype: sign-in isn&apos;t connected to a server yet, so any email and password work.
      </Text>
    </VStack>
  );
}
