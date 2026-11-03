import { router, Stack, useLocalSearchParams } from 'expo-router';

import { CATEGORY_COLORS, CATEGORY_KIND_LABELS, DEFAULT_CATEGORY_COLOR } from '@/lib/constants';
import { AddIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { useLedger } from '@/lib/hooks';
import type { Category, CategoryKind } from '@/lib/types';
import { Card, IconButton, InitialBadge, ListRow, ScreenContainer, SectionHeader } from '@/lib/ui';

export function CategoriesScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: CategoryKind = params.kind === 'income_source' ? 'income_source' : 'expense';
  const { categories } = useLedger();
  const list = categories.filter((c) => c.kind === kind);
  const active = list.filter((c) => !c.archived);
  const archived = list.filter((c) => c.archived);
  const labels = CATEGORY_KIND_LABELS[kind];

  const renderList = (items: Category[]) => (
    <Card>
      {items.map((category, index) => (
        <ListRow
          key={category.id}
          divider={index > 0}
          muted={category.archived}
          leading={<InitialBadge label={category.name} color={CATEGORY_COLORS[category.color ?? DEFAULT_CATEGORY_COLOR]} size="sm" />}
          title={category.name}
          onPress={() => router.push({ pathname: '/category-form', params: { id: category.id } })}
        />
      ))}
    </Card>
  );

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: labels.plural,
          headerRight: () => (
            <IconButton
              icon={AddIcon}
              variant="primary"
              accessibilityLabel={`Add ${labels.singular.toLowerCase()}`}
              onPress={() => router.push({ pathname: '/category-form', params: { kind } })}
            />
          ),
        }}
      />
      <Text className="px-1 pt-4 text-sm text-muted-foreground">
        {kind === 'expense'
          ? 'What you spend on. Shop and place names go in the note, not here.'
          : 'Where money comes in from.'}
      </Text>
      <SectionHeader title="Active" right={String(active.length)} />
      {renderList(active)}
      {archived.length > 0 ? (
        <>
          <SectionHeader title="Archived" />
          {renderList(archived)}
        </>
      ) : null}
    </ScreenContainer>
  );
}
