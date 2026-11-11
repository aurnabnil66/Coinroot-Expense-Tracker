import { Path } from 'react-native-svg';

import { createIcon } from '@/lib/gluestack-ui/icon';

/** Lucide-style icons the gluestack set doesn't have. Use with `<Icon as={TagIcon} />`. */
const stroke = { strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const TagIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"
        {...stroke}
      />
      <Path d="M7.5 7.5h.01" {...stroke} />
    </>
  ),
});

export const BanknoteIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" {...stroke} />
      <Path d="M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0" {...stroke} />
      <Path d="M6 12h.01M18 12h.01" {...stroke} />
    </>
  ),
});

export const UploadIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...stroke} />
      <Path d="M17 8l-5-5-5 5" {...stroke} />
      <Path d="M12 3v12" {...stroke} />
    </>
  ),
});

export const SpreadsheetIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" {...stroke} />
      <Path d="M14 2v4a2 2 0 0 0 2 2h4" {...stroke} />
      <Path d="M8 13h2M14 13h2M8 17h2M14 17h2" {...stroke} />
    </>
  ),
});

export const ZapIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <Path
      d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
      {...stroke}
    />
  ),
});

export const PaletteIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"
        {...stroke}
      />
      <Path d="M13.5 6.5h.01M17.5 10.5h.01M6.5 12.5h.01M8.5 7.5h.01" {...stroke} />
    </>
  ),
});
