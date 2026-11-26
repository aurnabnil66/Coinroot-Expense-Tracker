import { HStack } from '@/lib/gluestack-ui/hstack';
import { DownloadIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useAppUpdate, useDailyUpdateCheck } from '@/lib/hooks';
import { Button, Card, IconBadge } from '@/lib/ui';
import { updateStore } from '@/lib/updates';

/**
 * "Coinroot 1.2.0 is available" at the top of the Transactions list, when a newer APK is on
 * GitHub Releases. Also runs the daily check. Download opens the APK in the browser; Later hides
 * it until an even newer version comes out.
 */
export function UpdateBanner() {
  useDailyUpdateCheck();
  const { banner } = useAppUpdate();
  if (!banner) return null;

  return (
    <Card className="mt-4 gap-3 p-4">
      <HStack className="items-center gap-3">
        <IconBadge icon={DownloadIcon} tone="primary" />
        <VStack className="flex-1">
          <Text className="text-base font-semibold text-foreground">Coinroot {banner.version} is available</Text>
          <Text className="text-sm text-muted-foreground">Install it over this version. Your data stays.</Text>
        </VStack>
      </HStack>
      <HStack className="gap-2">
        <Button
          label="Download"
          icon={DownloadIcon}
          size="sm"
          className="flex-1"
          onPress={() => void updateStore.download(banner)}
        />
        <Button
          label="Later"
          variant="ghost"
          color="muted"
          size="sm"
          onPress={() => updateStore.dismiss(banner.version)}
        />
      </HStack>
    </Card>
  );
}
