import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import {
  newPasswordFormDefaults,
  type NewPasswordFormInput,
  newPasswordFormSchema,
  type NewPasswordFormValues,
  PASSWORD_MIN,
} from '@/lib/schemas';
import { AuthError, authLinkParams, authStore, readAuthLink } from '@/lib/supabase';
import { Button, EmptyState, ErrorState, LoadingState, ModalHeader, ScreenContainer, TextField, useDialog } from '@/lib/ui';

type Result =
  | { step: 'confirmed'; email: string }
  | { step: 'new-password'; email: string }
  | { step: 'error'; message: string };

/** Links already being opened: each one works only once, so a remount must not reuse it. */
const opened = new Set<string>();

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Plain string values of the route's query (`?error=…`). */
function queryValues(params: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : []))
  );
}

/**
 * Opened by an email link: `coinroot://auth-callback?code=…&sb_flow_id=…` (or `?error=…`).
 * Redeems the code (only works on the phone that asked for the email), then shows "Email
 * confirmed" or the "New password" form. Errors can come in the fragment, which the router
 * drops, so the full URL also comes from expo-linking.
 */
export function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const url = Linking.useLinkingURL();
  const link = readAuthLink({
    ...queryValues(params),
    ...authLinkParams(url?.includes('auth-callback') ? url : null),
  });
  const [result, setResult] = useState<Result | null>(null);

  const code = link.kind === 'code' ? link.code : null;
  const flowId = link.kind === 'code' ? link.flowId : null;

  useEffect(() => {
    if (!code || opened.has(code)) return;
    opened.add(code);
    authStore.openLink({ kind: 'code', code, flowId }).then(
      ({ session, purpose }) => {
        setResult({ step: purpose === 'recovery' ? 'new-password' : 'confirmed', email: session.email });
      },
      (e: unknown) =>
        setResult({ step: 'error', message: e instanceof AuthError ? e.message : "This link didn't work. Ask for a new one." })
    );
  }, [code, flowId]);

  const shown: Result | null =
    result ??
    (link.kind === 'error'
      ? { step: 'error', message: link.message }
      : link.kind === 'none'
        ? { step: 'error', message: "This link is incomplete. Open it again from the email, or ask for a new one." }
        : null);

  const title = shown?.step === 'new-password' ? 'New password' : shown?.step === 'confirmed' ? 'Email confirmed' : 'Opening link';

  return (
    <View className="flex-1 bg-background">
      <ModalHeader title={title} onClose={close} />
      {!shown ? (
        <LoadingState label="Opening the link…" />
      ) : shown.step === 'error' ? (
        <VStack className="items-center">
          <ErrorState title="The link didn't work" message={shown.message} />
          <Button label="Close" variant="outline" className="px-6" onPress={close} />
        </VStack>
      ) : shown.step === 'confirmed' ? (
        <EmptyState
          title="You're all set"
          message={`Your email is confirmed and you're logged in as ${shown.email}.`}
          action={<Button label="Done" className="mt-3 px-8" onPress={close} />}
        />
      ) : (
        <ScreenContainer>
          <VStack className="pt-6">
            <NewPasswordForm email={shown.email} onDone={close} />
          </VStack>
        </ScreenContainer>
      )}
    </View>
  );
}

function NewPasswordForm({ email, onDone }: { email: string; onDone: () => void }) {
  const dialog = useDialog();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordFormInput, unknown, NewPasswordFormValues>({
    resolver: zodResolver(newPasswordFormSchema),
    defaultValues: newPasswordFormDefaults(),
    mode: 'onTouched',
  });

  const onSubmit = async ({ password }: NewPasswordFormValues) => {
    try {
      await authStore.updatePassword(password);
    } catch (e) {
      setError('root', { message: e instanceof AuthError ? e.message : 'Could not save the new password. Please try again.' });
      return;
    }
    await dialog.alert({ title: 'Password changed', message: 'Use it the next time you log in.', tone: 'success' });
    onDone();
  };

  return (
    <VStack className="gap-5">
      <Text className="text-sm text-muted-foreground">Choose a new password for {email}.</Text>
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label="New password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            hint={`At least ${PASSWORD_MIN} characters, with a letter and a number`}
            type="new-password"
            autoFocus
          />
        )}
      />
      {errors.root ? <Text className="text-sm text-destructive">{errors.root.message}</Text> : null}
      <Button label="Save password" size="lg" loading={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </VStack>
  );
}
