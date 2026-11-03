import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';

export type BarDatum = {
  key: string;
  value: number;
  /** Shown under the bar; leave empty to skip a label (e.g. most days of a month). */
  label?: string;
  accessibilityLabel: string;
};

type BarChartProps = {
  data: readonly BarDatum[];
  /** Value at the top of the chart; bars are drawn relative to it. */
  maxValue: number;
  /** Formats the axis values (top and middle gridlines). */
  formatValue: (value: number) => string;
  selectedKey: string | null;
  /** Tapping a bar selects it; tapping it again clears the selection. */
  onSelect: (key: string | null) => void;
  /** Bar to emphasise when nothing is selected, e.g. today. */
  highlightKey?: string;
};

/** Vertical bar chart drawn with plain views, coloured from the theme. */
export function BarChart({ data, maxValue, formatValue, selectedKey, onSelect, highlightKey }: BarChartProps) {
  const dense = data.length > 12;
  const hasSelection = data.some((d) => d.key === selectedKey);

  const barClass = (key: string) => {
    if (hasSelection) return key === selectedKey ? 'bg-primary' : 'bg-primary/20';
    return key === highlightKey ? 'bg-primary' : 'bg-primary/45';
  };

  return (
    <HStack className="gap-2">
      <Box className="flex-1">
        <Box className="h-40">
          {[0, 50, 100].map((top) => (
            <Box key={top} className="absolute inset-x-0 h-px bg-border/70" style={{ top: `${top}%` }} />
          ))}
          <HStack className="h-full items-end">
            {data.map((d) => {
              const percent = maxValue > 0 ? Math.min(100, (d.value / maxValue) * 100) : 0;
              return (
                <Pressable
                  key={d.key}
                  onPress={() => onSelect(d.key === selectedKey ? null : d.key)}
                  accessibilityRole="button"
                  accessibilityLabel={d.accessibilityLabel}
                  accessibilityState={{ selected: d.key === selectedKey }}
                  className={`h-full flex-1 justify-end ${dense ? 'px-px' : 'px-2'}`}>
                  {d.value > 0 ? (
                    <Box
                      className={`${dense ? 'rounded-t-sm' : 'rounded-t-lg'} ${barClass(d.key)}`}
                      style={{ height: `${Math.max(percent, 2)}%` }}
                    />
                  ) : (
                    <Box className="h-1 rounded-full bg-muted" />
                  )}
                </Pressable>
              );
            })}
          </HStack>
        </Box>
        <HStack className="mt-1.5">
          {data.map((d) => (
            <Box key={d.key} className="flex-1 items-center">
              {d.label ? (
                <Text
                  numberOfLines={1}
                  className={`w-10 text-center text-[11px] ${
                    d.key === selectedKey ? 'font-bold text-primary' : 'text-muted-foreground'
                  }`}>
                  {d.label}
                </Text>
              ) : null}
            </Box>
          ))}
        </HStack>
      </Box>
      <Box className="h-40 w-11 justify-between">
        <Text className="-mt-1.5 text-[11px] tabular-nums text-muted-foreground">
          {maxValue > 0 ? formatValue(maxValue) : ''}
        </Text>
        <Text className="text-[11px] tabular-nums text-muted-foreground">
          {maxValue > 0 ? formatValue(maxValue / 2) : ''}
        </Text>
        <Text className="-mb-1.5 text-[11px] tabular-nums text-muted-foreground">{maxValue > 0 ? '0' : ''}</Text>
      </Box>
    </HStack>
  );
}
