import { Box } from '@/lib/gluestack-ui/box';

type ProgressBarProps = {
  /** 0–1 */
  value: number;
  /** Hex colour of the filled part. */
  color: string;
};

export function ProgressBar({ value, color }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  return (
    <Box className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <Box className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
    </Box>
  );
}
