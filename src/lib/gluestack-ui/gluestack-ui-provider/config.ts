import { vars } from 'nativewind';

// Raw color values - update these and they sync everywhere
// Coinroot palette: navy + purple brand, light blue accent.
// Light mode: soft lavender-white page, white cards, purple primary.
// Dark mode: deep navy page, navy cards, lighter purple primary.
// income / expense / transfer colours are used only for money meaning.
// tab-bar / tab-item / tab-icon: the floating tab bar and its round inactive buttons (white in light, navy in dark).
export const colors = {
  light: {
    '--primary': '108 76 241',
    '--primary-foreground': '255 255 255',
    '--card': '255 255 255',
    '--secondary': '235 238 255',
    '--secondary-foreground': '30 42 94',
    '--background': '245 246 252',
    '--popover': '255 255 255',
    '--popover-foreground': '17 24 59',
    '--muted': '238 240 250',
    '--muted-foreground': '102 110 145',
    '--destructive': '220 38 38',
    '--foreground': '17 24 59',
    '--border': '226 229 242',
    '--input': '218 222 240',
    '--ring': '108 76 241',
    '--accent': '238 240 252',
    '--accent-foreground': '30 42 94',
    '--sky': '56 189 248',
    '--hero-start': '30 42 94',
    '--hero-end': '108 76 241',
    '--income': '16 185 129',
    '--expense': '244 63 94',
    '--transfer': '14 165 233',
    '--warning': '217 119 6',
    '--tab-bar': '255 255 255',
    '--tab-item': '238 240 250',
    '--tab-icon': '102 110 145',
  },
  dark: {
    '--primary': '157 135 255',
    '--primary-foreground': '19 16 58',
    '--card': '22 29 61',
    '--secondary': '37 46 92',
    '--secondary-foreground': '226 231 255',
    '--background': '11 16 38',
    '--popover': '22 29 61',
    '--popover-foreground': '236 239 255',
    '--muted': '30 38 76',
    '--muted-foreground': '150 158 200',
    '--destructive': '248 113 113',
    '--foreground': '236 239 255',
    '--border': '38 47 90',
    '--input': '50 60 108',
    '--ring': '157 135 255',
    '--accent': '32 41 82',
    '--accent-foreground': '236 239 255',
    '--sky': '125 211 252',
    '--hero-start': '36 56 140',
    '--hero-end': '124 77 255',
    '--income': '52 211 153',
    '--expense': '251 113 133',
    '--transfer': '125 211 252',
    '--warning': '251 191 36',
    '--tab-bar': '30 38 76',
    '--tab-item': '45 55 102',
    '--tab-icon': '170 178 215',
  },
};

// Config for nativewind vars() - used by provider
export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};
