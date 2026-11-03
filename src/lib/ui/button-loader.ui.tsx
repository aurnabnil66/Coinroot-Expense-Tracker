import { ButtonSpinner } from '@/lib/gluestack-ui/button';
import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';

type ButtonLoaderProps = {
  /** Spinner colour: on a filled primary button, or on an outline / ghost one. */
  tone?: 'onPrimary' | 'onDestructive' | 'primary' | 'destructive';
};

/** Spinner sized for a gluestack `Button`, coloured from the theme. */
export function ButtonLoader({ tone = 'onPrimary' }: ButtonLoaderProps) {
  const colors = useGluestackColors();
  const color = {
    onPrimary: colors.primaryForeground,
    // Filled destructive buttons use white text.
    onDestructive: '#ffffff',
    primary: colors.primary,
    destructive: colors.destructive,
  }[tone];
  return <ButtonSpinner color={color} />;
}
