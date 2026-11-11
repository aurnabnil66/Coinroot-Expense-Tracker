import { Button } from './button.ui';
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
          <Button label="Try again" variant="outline" className="mt-3 px-6" onPress={onRetry} />
        ) : null
      }
    />
  );
}
