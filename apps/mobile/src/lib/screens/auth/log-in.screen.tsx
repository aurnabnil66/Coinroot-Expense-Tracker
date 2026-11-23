import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { emailSchema, type LogInFormInput, type LogInFormValues, logInFormDefaults, logInFormSchema } from '@/lib/schemas';
import { AuthError, authStore, isCloudConfigured } from '@/lib/supabase';
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
  /** Awaited, with the button still loading (setup waits for the first sync here). */
  onDone: () => void | Promise<void>;
  onSignUp: () => void;
};

export function LogInForm({ onDone, onSignUp }: LogInFormProps) {
  const dialog = useDialog();
  const {
    control,
    getValues,
    handleSubmit,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<LogInFormInput, unknown, LogInFormValues>({
    resolver: zodResolver(logInFormSchema),
    defaultValues: logInFormDefaults(),
    mode: 'onTouched',
  });

  const onSubmit = async (values: LogInFormValues) => {
    try {
      // Also brings the account's nickname and phone to this phone.
      await authStore.signIn(values);
    } catch (e) {
      setError('root', { message: e instanceof AuthError ? e.message : 'Could not log in. Please try again.' });
      return;
    }
    await onDone();
  };

  const forgotPassword = async () => {
    // The reset link goes to the email typed above, so it must be valid first.
    const email = emailSchema.safeParse(getValues('email'));
    if (!email.success) {
      await trigger('email');
      await dialog.alert({ title: 'Reset password', message: 'Enter your email above first.', tone: 'info' });
      return;
    }
    const sent = await dialog.confirm({
      title: 'Reset password?',
      message: `We'll email a link to ${email.data}. Open it on this phone to choose a new password.`,
      confirmLabel: 'Send link',
      onConfirm: () => authStore.sendPasswordReset(email.data),
    });
    if (sent) {
      await dialog.alert({
        title: 'Check your email',
        message: `If ${email.data} has a Coinroot account, a reset link is on its way.`,
        tone: 'success',
      });
    }
  };

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
      {isCloudConfigured ? null : (
        <Text className="text-center text-xs text-muted-foreground">
          Sign-in isn&apos;t set up in this copy of Coinroot. Everything else works without an account.
        </Text>
      )}
    </VStack>
  );
}
