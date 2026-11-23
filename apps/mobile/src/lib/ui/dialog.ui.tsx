import {
  type ComponentProps,
  createContext,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Box } from '@/lib/gluestack-ui/box';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  HelpCircleIcon,
  Icon,
  InfoIcon,
} from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';

import { Button, type ButtonColor, type ButtonVariant } from './button.ui';
import { Card } from './card.ui';

/** Sets the icon and its colour: a question, information, success, caution or something destructive. */
export type DialogTone = 'default' | 'info' | 'success' | 'warning' | 'danger';

type IconComponent = ComponentProps<typeof Icon>['as'];

export type DialogAction = {
  label: string;
  /** What `show()` resolves to when this button is pressed. */
  value: string;
  variant?: 'primary' | 'destructive' | 'secondary' | 'ghost';
  /**
   * Runs before the dialog closes, with a spinner on the button meanwhile (e.g. a delete).
   * If it throws, the dialog stays open and shows `errorMessage`.
   */
  onPress?: () => unknown;
};

export type DialogOptions = {
  title: string;
  /** Text, or any content for richer information. */
  message?: ReactNode;
  tone?: DialogTone;
  /** Replaces the tone's icon; `null` hides the icon. */
  icon?: IconComponent | null;
  /** Buttons from left to right (stacked when there are more than two). Defaults to a single "OK". */
  actions?: DialogAction[];
  /** The back button and tapping outside close the dialog, resolving to `null` (default true). */
  dismissible?: boolean;
  /** Shown when an action's `onPress` throws. */
  errorMessage?: string;
};

export type ConfirmOptions = Omit<DialogOptions, 'actions'> & {
  confirmLabel?: string;
  cancelLabel?: string;
  /** The work to do on confirm, awaited inside the dialog. */
  onConfirm?: () => unknown;
};

export type AlertOptions = Omit<DialogOptions, 'actions'> & {
  okLabel?: string;
};

const TONES: Record<DialogTone, { icon: IconComponent; badge: string; iconClass: string }> = {
  default: { icon: HelpCircleIcon, badge: 'bg-primary/20 dark:bg-primary/25', iconClass: 'text-primary' },
  info: { icon: InfoIcon, badge: 'bg-sky/20 dark:bg-sky/25', iconClass: 'text-sky' },
  success: { icon: CheckCircleIcon, badge: 'bg-income/20 dark:bg-income/25', iconClass: 'text-income' },
  warning: { icon: AlertCircleIcon, badge: 'bg-warning/20 dark:bg-warning/25', iconClass: 'text-warning' },
  danger: { icon: AlertCircleIcon, badge: 'bg-destructive/20 dark:bg-destructive/25', iconClass: 'text-destructive' },
};

/** How each dialog action looks, as `Button` props. */
const ACTION_STYLES: Record<NonNullable<DialogAction['variant']>, { variant: ButtonVariant; color: ButtonColor }> = {
  primary: { variant: 'solid', color: 'primary' },
  destructive: { variant: 'solid', color: 'danger' },
  secondary: { variant: 'soft', color: 'primary' },
  ghost: { variant: 'ghost', color: 'muted' },
};

const OK_ACTION: DialogAction = { label: 'OK', value: 'ok', variant: 'primary' };

type DialogProps = DialogOptions & {
  open: boolean;
  /** Called with the pressed action's value, or `null` when dismissed. */
  onClose: (value: string | null) => void;
};

/** Centred modal dialog for confirmations, cautions and important information. */
export function Dialog({
  open,
  onClose,
  title,
  message,
  tone = 'default',
  icon,
  actions = [OK_ACTION],
  dismissible = true,
  errorMessage = 'Something went wrong. Please try again.',
}: DialogProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const { icon: toneIcon, badge, iconClass } = TONES[tone];
  const row = actions.length === 2;

  const press = async (action: DialogAction) => {
    if (busy) return;
    setFailed(false);
    if (action.onPress) {
      setBusy(action.value);
      try {
        await action.onPress();
      } catch {
        setFailed(true);
        return;
      } finally {
        setBusy(null);
      }
    }
    onClose(action.value);
  };

  const dismiss = () => {
    if (!dismissible || busy) return;
    setFailed(false);
    onClose(null);
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}>
      <Box className="flex-1 items-center justify-center px-6">
        <Pressable
          onPress={dismiss}
          accessibilityLabel="Close"
          accessible={dismissible}
          className="absolute inset-0 bg-black/50"
        />
        <Animated.View entering={ZoomIn.duration(180)} style={{ width: '100%', maxWidth: 400 }}>
          <Card className="items-center gap-2 p-6" accessibilityViewIsModal>
            {icon === null ? null : (
              <Box className={`mb-2 h-14 w-14 items-center justify-center rounded-full ${badge}`}>
                <Icon as={icon ?? toneIcon} size="xl" className={iconClass} />
              </Box>
            )}
            <Text accessibilityRole="header" className="text-center text-lg font-semibold text-foreground">
              {title}
            </Text>
            {typeof message === 'string' ? (
              <Text className="text-center text-sm leading-6 text-muted-foreground">{message}</Text>
            ) : (
              message
            )}
            {failed ? <Text className="text-center text-sm font-medium text-destructive">{errorMessage}</Text> : null}

            <Box className={`mt-4 w-full gap-2 ${row ? 'flex-row' : ''}`}>
              {actions.map((action) => (
                <Button
                  key={action.value}
                  label={action.label}
                  {...ACTION_STYLES[action.variant ?? 'primary']}
                  className={`rounded-2xl ${row ? 'flex-1' : ''}`}
                  loading={busy === action.value}
                  disabled={busy !== null}
                  onPress={() => void press(action)}
                />
              ))}
            </Box>
          </Card>
        </Animated.View>
      </Box>
    </Modal>
  );
}

export type DialogApi = {
  /** Shows a dialog; resolves to the pressed action's value, or `null` if dismissed. */
  show: (options: DialogOptions) => Promise<string | null>;
  /** "Are you sure?" with Cancel / Confirm; resolves to true only when confirmed (and `onConfirm` succeeded). */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Information with a single OK button; resolves when closed. */
  alert: (options: AlertOptions) => Promise<void>;
};

type DialogRequest = {
  id: number;
  options: DialogOptions;
  resolve: (value: string | null) => void;
};

const DialogContext = createContext<DialogApi | null>(null);

/** Renders dialogs requested through `useDialog()`, one at a time in order. Mount once near the app root. */
export function DialogProvider({ children }: PropsWithChildren) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const nextId = useRef(0);

  const show = useCallback(
    (options: DialogOptions) =>
      new Promise<string | null>((resolve) => {
        nextId.current += 1;
        const request = { id: nextId.current, options, resolve };
        setQueue((current) => [...current, request]);
      }),
    []
  );

  const api = useMemo<DialogApi>(
    () => ({
      show,
      confirm: async ({ confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, ...options }) => {
        const value = await show({
          ...options,
          actions: [
            { label: cancelLabel, value: 'cancel', variant: 'secondary' },
            {
              label: confirmLabel,
              value: 'confirm',
              variant: options.tone === 'danger' ? 'destructive' : 'primary',
              onPress: onConfirm,
            },
          ],
        });
        return value === 'confirm';
      },
      alert: async ({ okLabel = 'OK', ...options }) => {
        await show({ ...options, actions: [{ ...OK_ACTION, label: okLabel }] });
      },
    }),
    [show]
  );

  const current = queue[0];
  const close = (value: string | null) => {
    current?.resolve(value);
    setQueue((pending) => pending.slice(1));
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current ? <Dialog key={current.id} open {...current.options} onClose={close} /> : null}
    </DialogContext.Provider>
  );
}

/** Opens dialogs from anywhere below `DialogProvider`: `await dialog.confirm({ … })`. */
export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialog must be used inside DialogProvider');
  return api;
}
