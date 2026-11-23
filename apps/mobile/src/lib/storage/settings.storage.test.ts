import { describe, expect, it, jest } from '@jest/globals';

import { createBooleanSetting, createEnumSetting } from './settings.storage';

// The real module loads a native (Nitro) module, so tests use an in-memory stand-in.
jest.mock('react-native-mmkv', () => {
  const values = new Map<string, string | boolean | number>();
  return {
    createMMKV: () => ({
      getString: (key: string) => {
        const value = values.get(key);
        return typeof value === 'string' ? value : undefined;
      },
      getBoolean: (key: string) => {
        const value = values.get(key);
        return typeof value === 'boolean' ? value : undefined;
      },
      set: (key: string, value: string | boolean | number) => values.set(key, value),
    }),
  };
});

describe('settings storage', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(createBooleanSetting('test-empty-bool', false).get()).toBe(false);
    expect(createEnumSetting('test-empty-enum', ['a', 'b'] as const, 'a').get()).toBe('a');
  });

  it('persists values across setting instances with the same key', () => {
    createEnumSetting('test-persist', ['light', 'dark'] as const, 'light').set('dark');
    expect(createEnumSetting('test-persist', ['light', 'dark'] as const, 'light').get()).toBe('dark');

    createBooleanSetting('test-persist-bool', false).set(true);
    expect(createBooleanSetting('test-persist-bool', false).get()).toBe(true);
  });

  it('ignores stored values that are not allowed', () => {
    createEnumSetting('test-invalid', ['x', 'y', 'z'] as const, 'x').set('z');
    expect(createEnumSetting('test-invalid', ['x', 'y'] as const, 'x').get()).toBe('x');
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const setting = createBooleanSetting('test-listen', false);
    const listener = jest.fn();
    const unsubscribe = setting.subscribe(listener);

    setting.set(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setting.set(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
