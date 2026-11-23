import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';

import { Button } from './button.ui';

type LinkPromptProps = {
  question: string;
  action: string;
  onPress: () => void;
};

/** Centred "Already have an account? Log in" line with a tappable action. */
export function LinkPrompt({ question, action, onPress }: LinkPromptProps) {
  return (
    <HStack className="items-center justify-center gap-1">
      <Text className="text-sm text-muted-foreground">{question}</Text>
      <Button label={action} variant="link" onPress={onPress} />
    </HStack>
  );
}
