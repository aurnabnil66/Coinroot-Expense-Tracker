import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { CATEGORY_COLORS, CATEGORY_KIND_LABELS, DEFAULT_CATEGORY_COLOR } from '@/lib/constants';
import { Button, ButtonText } from '@/lib/gluestack-ui/button';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { CheckIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useLedger } from '@/lib/hooks';
import { ledgerStore } from '@/lib/mocks';
import { type CategoryFormInput, type CategoryFormValues, categoryFormDefaults, categoryFormSchema } from '@/lib/schemas';
import { FieldShell, FormTextField, ModalHeader, ScreenContainer, SwitchRow } from '@/lib/ui';

export function CategoryFormScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { categories } = useLedger();
  const existing = params.id ? categories.find((c) => c.id === params.id) : undefined;
  const kind = existing?.kind ?? (params.kind === 'income_source' ? 'income_source' : 'expense');
  const label = CATEGORY_KIND_LABELS[kind].singular;

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: existing
      ? { name: existing.name, kind: existing.kind, color: existing.color, archived: existing.archived }
      : { ...categoryFormDefaults(), kind, color: DEFAULT_CATEGORY_COLOR },
    mode: 'onTouched',
  });

  const onSubmit = (values: CategoryFormValues) => {
    try {
      const input = { ...values, icon: existing?.icon ?? null };
      if (existing) ledgerStore.updateCategory(existing.id, input);
      else ledgerStore.addCategory(input);
      router.back();
    } catch {
      setError('root', { message: 'Could not save. Please try again.' });
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ModalHeader title={existing ? `Edit ${label.toLowerCase()}` : `New ${label.toLowerCase()}`} onClose={() => router.back()} />
      <ScreenContainer>
        <VStack className="gap-5 pt-5">
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FormTextField
                label="Name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                placeholder={kind === 'expense' ? 'e.g. Transport' : 'e.g. Salary'}
                autoFocus={!existing}
                maxLength={40}
              />
            )}
          />

          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <FieldShell label="Colour">
                <HStack className="flex-wrap gap-3">
                  {Object.entries(CATEGORY_COLORS).map(([key, hex]) => {
                    const selected = field.value === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => field.onChange(key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={key}
                        className={`h-10 w-10 items-center justify-center rounded-full ${selected ? 'border-2 border-foreground' : ''}`}
                        style={{ backgroundColor: hex }}>
                        {selected ? <Icon as={CheckIcon} size="sm" className="text-white" /> : null}
                      </Pressable>
                    );
                  })}
                </HStack>
              </FieldShell>
            )}
          />

          {existing ? (
            <Controller
              control={control}
              name="archived"
              render={({ field }) => (
                <SwitchRow
                  label="Archived"
                  description="Hidden from pickers. Past transactions keep it."
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
          ) : null}

          {errors.root ? <Text className="text-sm text-destructive">{errors.root.message}</Text> : null}

          <Button size="lg" className="h-12 rounded-xl" onPress={() => void handleSubmit(onSubmit)()} isDisabled={isSubmitting}>
            <ButtonText className="text-base font-semibold">{existing ? 'Save changes' : `Add ${label.toLowerCase()}`}</ButtonText>
          </Button>
        </VStack>
      </ScreenContainer>
    </View>
  );
}
