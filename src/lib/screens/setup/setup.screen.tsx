import { zodResolver } from '@hookform/resolvers/zod';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LedgerPending } from '@/lib/components';
import { ACCOUNT_TYPE_COLORS, SETUP_ACCOUNT_OPTIONS } from '@/lib/constants';
import { Box } from '@/lib/gluestack-ui/box';
import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { AddIcon, CheckIcon, ChevronLeftIcon, CloseIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useCategoryColors, useLedger } from '@/lib/hooks';
import { ledgerStore } from '@/lib/db';
import { LogInForm } from '@/lib/screens/auth/log-in.screen';
import { SignUpForm } from '@/lib/screens/auth/sign-up.screen';
import { ProfileForm } from '@/lib/screens/profile/profile-form.screen';
import { type SetupFormInput, type SetupFormValues, setupFormDefaults, setupFormSchema } from '@/lib/schemas';
import { profileSetting } from '@/lib/storage';
import type { AccountType } from '@/lib/types';
import { Button, Card, IconButton, InitialBadge, ScreenContainer, SectionHeader, TextField } from '@/lib/ui';
import { todayKey } from '@/lib/utils';

/** Step 1 is one of `sign-up`, `log-in` or `profile` (no account); then `types` and `accounts`. */
type Step = 'welcome' | 'sign-up' | 'log-in' | 'profile' | 'types' | 'accounts';
type FirstStep = 'sign-up' | 'log-in' | 'profile';

const STEP_COUNT = 3;

/**
 * First launch: create an account, log in, or just make a profile (an account is optional);
 * then which kinds of accounts you use, their names and today's balances.
 */
export function SetupScreen() {
  const { status, error } = useLedger();
  if (status === 'ready') return <SetupFlow />;
  return (
    <View className="flex-1 justify-center bg-background">
      <LedgerPending status={status} error={error} />
    </View>
  );
}

function SetupFlow() {
  const [step, setStep] = useState<Step>('welcome');
  // Where "Back" from the account types goes.
  const [firstStep, setFirstStep] = useState<FirstStep>('profile');
  const start = (next: FirstStep) => {
    setFirstStep(next);
    setStep(next);
  };
  const [types, setTypes] = useState<AccountType[]>([]);
  const palette = useCategoryColors();
  const form = useForm<SetupFormInput, unknown, SetupFormValues>({
    resolver: zodResolver(setupFormSchema),
    defaultValues: setupFormDefaults(),
    mode: 'onTouched',
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'accounts' });

  // Android back goes to the previous step instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'accounts') setStep('types');
      else if (step === 'types') setStep(firstStep);
      else if (step !== 'welcome') setStep('welcome');
      else return false;
      return true;
    });
    return () => sub.remove();
  }, [step, firstStep]);

  const toAccounts = () => {
    // Keep rows already entered for a type; add one default row for each newly chosen type.
    const current = form.getValues('accounts');
    replace(
      SETUP_ACCOUNT_OPTIONS.filter((o) => types.includes(o.type)).flatMap((o) => {
        const kept = current.filter((a) => a.type === o.type);
        return kept.length > 0 ? kept : [{ type: o.type, name: o.defaultName, openingBalance: '' }];
      })
    );
    setStep('accounts');
  };

  const onSubmit = async (values: SetupFormValues) => {
    try {
      const openingDate = todayKey();
      await ledgerStore.completeSetup(
        values.accounts.map((a) => ({ ...a, openingDate, archived: false, savings: null }))
      );
      // The root layout's guard switches to the app once setup is done.
    } catch {
      form.setError('root', { message: 'Could not save your accounts. Please try again.' });
    }
  };

  if (step === 'welcome') return <Welcome onStart={start} />;

  if (step === 'sign-up') {
    return (
      <FirstStepScreen title="Create your account" subtitle="Your data stays on this phone. The account is for backup and sync later." onBack={() => setStep('welcome')}>
        <SignUpForm onDone={() => setStep('types')} onLogIn={() => start('log-in')} />
      </FirstStepScreen>
    );
  }

  if (step === 'log-in') {
    // A profile without a nickname (e.g. a new phone) is filled in next.
    const afterLogIn = () => (profileSetting.get().nickname ? setStep('types') : start('profile'));
    return (
      <FirstStepScreen title="Welcome back" subtitle="Log in with the email you signed up with." onBack={() => setStep('welcome')}>
        <LogInForm onDone={afterLogIn} onSignUp={() => start('sign-up')} />
      </FirstStepScreen>
    );
  }

  if (step === 'profile') {
    return (
      <FirstStepScreen title="Create your profile" subtitle="It stays on this phone. You can change it any time." onBack={() => setStep('welcome')}>
        <ProfileForm submitLabel="Continue" onDone={() => setStep('types')} />
      </FirstStepScreen>
    );
  }

  if (step === 'types') {
    const toggle = (type: AccountType) =>
      setTypes((current) => (current.includes(type) ? current.filter((t) => t !== type) : [...current, type]));
    return (
      <ScreenContainer safeTop>
        <StepHeader step={2} onBack={() => setStep(firstStep)} />
        <Text className="text-2xl font-semibold text-foreground">What do you use for money?</Text>
        <Text className="mt-2 text-base text-muted-foreground">Pick everything that applies. You can add more accounts later.</Text>
        <VStack className="mt-6 gap-3">
          {SETUP_ACCOUNT_OPTIONS.map((option) => (
            <TypeOption
              key={option.type}
              title={option.title}
              description={option.description}
              color={palette[ACCOUNT_TYPE_COLORS[option.type]]}
              selected={types.includes(option.type)}
              onPress={() => toggle(option.type)}
            />
          ))}
        </VStack>
        <Text className="mt-4 text-sm text-muted-foreground">
          No bank account? No problem: cash and a mobile wallet are enough.
        </Text>
        <Button label="Continue" size="lg" className="mt-8" disabled={types.length === 0} onPress={toAccounts} />
      </ScreenContainer>
    );
  }

  const { isSubmitting, errors } = form.formState;
  return (
    <ScreenContainer safeTop>
      <StepHeader step={3} onBack={() => setStep('types')} />
      <Text className="text-2xl font-semibold text-foreground">Name your accounts</Text>
      <Text className="mt-2 text-base text-muted-foreground">
        Enter how much is in each one today. Not sure? Leave it empty and change it later.
      </Text>

      {SETUP_ACCOUNT_OPTIONS.filter((o) => types.includes(o.type)).map((option) => (
        <VStack key={option.type}>
          <SectionHeader title={option.title} />
          <VStack className="gap-3">
            {fields.map((row, index) =>
              row.type === option.type ? (
                <Card key={row.id} className="gap-3 p-4">
                  <HStack className="items-start gap-2">
                    <Box className="flex-1">
                      <Controller
                        control={form.control}
                        name={`accounts.${index}.name`}
                        render={({ field, fieldState }) => (
                          <TextField
                            label="Name"
                            value={field.value}
                            onChangeText={field.onChange}
                            onBlur={field.onBlur}
                            error={fieldState.error?.message}
                            maxLength={40}
                          />
                        )}
                      />
                    </Box>
                    {fields.length > 1 ? (
                      <Box className="pt-6">
                        <IconButton icon={CloseIcon} variant="ghost" onPress={() => remove(index)} accessibilityLabel={`Remove ${row.name}`} />
                      </Box>
                    ) : null}
                  </HStack>
                  <Controller
                    control={form.control}
                    name={`accounts.${index}.openingBalance`}
                    render={({ field, fieldState }) => (
                      <TextField
                        label="Balance today"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                        placeholder="৳ 0"
                        type="money"
                      />
                    )}
                  />
                </Card>
              ) : null
            )}
            <Button
              label="Add another"
              variant="link"
              icon={AddIcon}
              className="self-start"
              accessibilityLabel={`Add another ${option.title}`}
              onPress={() => append({ type: option.type, name: '', openingBalance: '' })}
            />
          </VStack>
        </VStack>
      ))}

      {errors.root ? <Text className="mt-4 text-sm text-destructive">{errors.root.message}</Text> : null}
      <Button
        label="Start using Coinroot"
        size="lg"
        className="mt-8"
        loading={isSubmitting}
        disabled={fields.length === 0}
        onPress={() => void form.handleSubmit(onSubmit)()}
      />
    </ScreenContainer>
  );
}

function Welcome({ onStart }: { onStart: (step: FirstStep) => void }) {
  const insets = useSafeAreaInsets();
  const colors = useGluestackColors();
  const [loadingSample, setLoadingSample] = useState(false);

  const exploreSample = async () => {
    setLoadingSample(true);
    await ledgerStore.loadSampleData();
  };

  return (
    <View className="flex-1 bg-background px-6" style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }}>
      <VStack className="flex-1 justify-center gap-8">
        <Box
          className="h-20 w-20 items-center justify-center rounded-3xl"
          style={{ experimental_backgroundImage: `linear-gradient(135deg, ${colors.heroStart} 0%, ${colors.heroEnd} 100%)` }}>
          <Text className="text-4xl font-semibold leading-[52px] text-white">৳</Text>
        </Box>
        <VStack className="gap-3">
          <Text className="text-[32px] font-semibold leading-10 text-foreground">Welcome to Coinroot</Text>
          <Text className="text-base leading-6 text-muted-foreground">
            See where every taka comes from and where it goes. Your data stays on this phone, and an account is optional.
          </Text>
        </VStack>
        <VStack className="gap-4">
          <Feature text="Works with cash and mobile wallets, no bank account needed" />
          <Feature text="Transfers between your own accounts never count as spending" />
          <Feature text="Savings and DPS kept apart from everyday money" />
        </VStack>
      </VStack>
      <VStack className="gap-3">
        <Button label="Create account" size="lg" disabled={loadingSample} onPress={() => onStart('sign-up')} />
        <Button label="Log in" variant="outline" size="lg" disabled={loadingSample} onPress={() => onStart('log-in')} />
        <Button label="Continue without an account" variant="link" className="mt-1" disabled={loadingSample} onPress={() => onStart('profile')} />
        <Button
          label="Explore with sample data"
          variant="link"
          color="muted"
          loading={loadingSample}
          onPress={() => void exploreSample()}
        />
      </VStack>
    </View>
  );
}

function FirstStepScreen({
  title,
  subtitle,
  onBack,
  children,
}: PropsWithChildren<{ title: string; subtitle: string; onBack: () => void }>) {
  return (
    <ScreenContainer safeTop>
      <StepHeader step={1} onBack={onBack} />
      <Text className="text-2xl font-semibold text-foreground">{title}</Text>
      <Text className="mb-6 mt-2 text-base text-muted-foreground">{subtitle}</Text>
      {children}
    </ScreenContainer>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <HStack className="items-center gap-3">
      <Box className="h-7 w-7 items-center justify-center rounded-full bg-primary/15">
        <Icon as={CheckIcon} size="xs" className="text-primary" />
      </Box>
      <Text className="flex-1 text-sm text-foreground">{text}</Text>
    </HStack>
  );
}

function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <HStack className="items-center justify-between pb-4 pt-2">
      <IconButton icon={ChevronLeftIcon} variant="ghost" onPress={onBack} accessibilityLabel="Back" />
      <HStack className="gap-1.5">
        {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((n) => (
          <Box key={n} className={`h-1.5 rounded-full ${n === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`} />
        ))}
      </HStack>
      <Text className="w-10 text-right text-xs font-medium text-muted-foreground">{step}/{STEP_COUNT}</Text>
    </HStack>
  );
}

type TypeOptionProps = {
  title: string;
  description: string;
  color: string;
  selected: boolean;
  onPress: () => void;
};

function TypeOption({ title, description, color, selected, onPress }: TypeOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      className={`flex-row items-center gap-3 rounded-xl border p-4 data-[active=true]:opacity-80 ${
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card'
      }`}>
      <InitialBadge label={title} color={color} />
      <VStack className="flex-1">
        <Text className="text-base font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground">{description}</Text>
      </VStack>
      <Box
        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
          selected ? 'border-primary bg-primary' : 'border-border'
        }`}>
        {selected ? <Icon as={CheckIcon} size="xs" className="text-primary-foreground" /> : null}
      </Box>
    </Pressable>
  );
}
