import type { TextInputProps } from 'react-native';

import { Input, InputField } from '@/lib/gluestack-ui/input';

import { FieldShell } from './field-shell.ui';

type FormTextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoFocus?: boolean;
  maxLength?: number;
};

export function FormTextField({ label, error, hint, multiline, ...inputProps }: FormTextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      <Input
        isInvalid={Boolean(error)}
        className={`rounded-2xl bg-card px-4 ${multiline ? 'h-24 items-start py-2' : 'h-14'}`}>
        <InputField
          {...inputProps}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          className="text-base"
        />
      </Input>
    </FieldShell>
  );
}
