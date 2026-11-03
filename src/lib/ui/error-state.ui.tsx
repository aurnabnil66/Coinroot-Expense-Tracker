import { Button, ButtonText } from '@/lib/gluestack-ui/button';

import { EmptyState } from './empty-state.ui';

type ErrorStateProps = {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
};

/** Shown when loading failed, with an optional "Try again" button. */
export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <EmptyState
      title={title}
      message={message ?? undefined}
      action={
        onRetry ? (
          <Button variant="outline" size="lg" className="mt-3 h-12 rounded-2xl px-6" onPress={onRetry}>
            <ButtonText className="text-base font-semibold">Try again</ButtonText>
          </Button>
        ) : null
      }
    />
  );
}
