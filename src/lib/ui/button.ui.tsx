import type { ComponentProps } from 'react';

import {
  Button as GluestackButton,
  ButtonIcon,
  ButtonText,
} from '@/lib/gluestack-ui/button';
import type { Icon } from '@/lib/gluestack-ui/icon';

import { ButtonLoader } from './button-loader.ui';

/**
 * - `solid`: filled, the main action of a screen
 * - `soft`: tinted background, a secondary action (e.g. Cancel in a dialog)
 * - `outline`: bordered, an alternative action
 * - `ghost`: no background until pressed, a quiet action (e.g. Delete at the bottom of a form)
 * - `link`: just text, for inline links ("Forgot password?")
 */
export type ButtonVariant = 'solid' | 'soft' | 'outline' | 'ghost' | 'link';
/** `danger` for destructive actions; `muted` for low-key links and ghost buttons. */
export type ButtonColor = 'primary' | 'danger' | 'muted';
/**
 * `sm`: compact pill (h-11) · `md` (default): modal forms and dialogs (h-12) · `lg`: full-screen flows (h-14).
 * For `link` only the text size changes: `sm` (default) or `md`/`lg` (text-base).
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  /** Leading icon (any gluestack icon, e.g. `AddIcon`). Hidden while loading. */
  icon?: ComponentProps<typeof Icon>['as'];
  /** Shows a spinner and disables the button (e.g. while a form saves). */
  loading?: boolean;
  /** Label shown while loading (defaults to `label`). */
  loadingLabel?: string;
  disabled?: boolean;
  /** Layout extras such as margins, `flex-1` or `self-start`. Conflicting classes override the defaults. */
  className?: string;
  accessibilityLabel?: string;
};

const SIZE_CLASS: Record<ButtonSize, { box: string; text: string; icon: 'sm' | 'default' }> = {
  sm: { box: 'h-11 rounded-full px-5', text: 'text-sm', icon: 'sm' },
  md: { box: 'h-12 rounded-xl px-4', text: 'text-base', icon: 'default' },
  lg: { box: 'h-14 rounded-2xl px-5', text: 'text-base', icon: 'default' },
};

/** Gluestack's own variant for the base look; colour overrides are added on top. */
const GLUESTACK_VARIANT = {
  solid: 'default',
  soft: 'secondary',
  outline: 'outline',
  ghost: 'ghost',
  link: 'ghost',
} as const;

const BOX_CLASS: Record<ButtonVariant, Record<ButtonColor, string>> = {
  solid: {
    primary: '',
    danger: 'bg-destructive data-[active=true]:bg-destructive/90 dark:bg-destructive',
    muted: 'bg-muted-foreground data-[active=true]:bg-muted-foreground/90',
  },
  soft: {
    primary: '',
    danger: 'bg-destructive/15 data-[active=true]:bg-destructive/25 dark:bg-destructive/25',
    muted: 'bg-muted data-[active=true]:bg-muted/80',
  },
  outline: {
    primary: 'border-primary bg-transparent data-[active=true]:bg-primary/10',
    danger: 'border-destructive/50 bg-transparent data-[active=true]:bg-destructive/10',
    muted: 'bg-transparent',
  },
  ghost: {
    primary: '',
    danger: 'data-[active=true]:bg-destructive/10',
    muted: '',
  },
  link: {
    primary: '',
    danger: '',
    muted: '',
  },
};

const TEXT_CLASS: Record<ButtonVariant, Record<ButtonColor, string>> = {
  solid: { primary: 'text-primary-foreground', danger: 'text-white', muted: 'text-background' },
  soft: { primary: 'text-secondary-foreground', danger: 'text-destructive', muted: 'text-foreground' },
  outline: { primary: 'text-primary', danger: 'text-destructive', muted: 'text-foreground' },
  ghost: { primary: 'text-primary', danger: 'text-destructive', muted: 'text-muted-foreground' },
  link: { primary: 'text-primary', danger: 'text-destructive', muted: 'text-muted-foreground' },
};

/** A link has no box: no height, no background, and it fades instead of filling when pressed. */
const LINK_BOX = 'h-auto rounded-md bg-transparent px-1 py-2 data-[active=true]:bg-transparent data-[active=true]:opacity-60';

const spinnerTone = (variant: ButtonVariant, color: ButtonColor) => {
  if (variant === 'solid') return color === 'danger' ? 'onDestructive' : 'onPrimary';
  return color === 'danger' ? 'destructive' : 'primary';
};

/**
 * The app's one button. Pick the look with `variant` + `color` + `size`; `loading` adds a
 * spinner and disables it. Use this, not gluestack's `Button`, everywhere in the app.
 *
 * ```tsx
 * <Button label="Save" loading={isSubmitting} onPress={save} />
 * <Button label="Delete transaction" variant="ghost" color="danger" onPress={confirmDelete} />
 * <Button label="Forgot password?" variant="link" className="self-end" onPress={forgot} />
 * ```
 */
export function Button({
  label,
  onPress,
  variant = 'solid',
  color = 'primary',
  size,
  icon,
  loading = false,
  loadingLabel,
  disabled = false,
  className = '',
  accessibilityLabel,
}: ButtonProps) {
  const isLink = variant === 'link';
  // Links are small text by default; `size="md"` gives a larger link (e.g. a header "Edit").
  const sizes = SIZE_CLASS[size ?? (isLink ? 'sm' : 'md')];
  const box = isLink ? LINK_BOX : sizes.box;
  const textClass = `${sizes.text} font-semibold ${TEXT_CLASS[variant][color]}`;

  return (
    <GluestackButton
      variant={GLUESTACK_VARIANT[variant]}
      className={`${box} ${BOX_CLASS[variant][color]} ${className}`}
      isDisabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}>
      {loading ? <ButtonLoader tone={spinnerTone(variant, color)} /> : icon ? <ButtonIcon as={icon} size={sizes.icon} className={TEXT_CLASS[variant][color]} /> : null}
      <ButtonText numberOfLines={1} className={textClass}>
        {loading && loadingLabel ? loadingLabel : label}
      </ButtonText>
    </GluestackButton>
  );
}
