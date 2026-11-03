import { vars } from 'nativewind';

// Raw color values - update these and they sync everywhere
// Coinroot palette: neutral greys, one deep-green accent ("the root"),
// and income / expense / transfer colours used only for money meaning.
export const colors = {
  light: {
    '--primary': '4 120 87',
    '--primary-foreground': '255 255 255',
    '--card': '255 255 255',
    '--secondary': '244 244 245',
    '--secondary-foreground': '24 24 27',
    '--background': '250 250 250',
    '--popover': '255 255 255',
    '--popover-foreground': '9 9 11',
    '--muted': '244 244 245',
    '--muted-foreground': '113 113 122',
    '--destructive': '220 38 38',
    '--foreground': '9 9 11',
    '--border': '228 228 231',
    '--input': '228 228 231',
    '--ring': '4 120 87',
    '--accent': '244 244 245',
    '--accent-foreground': '24 24 27',
    '--income': '22 163 74',
    '--expense': '225 29 72',
    '--transfer': '37 99 235',
  },
  dark: {
    '--primary': '52 211 153',
    '--primary-foreground': '2 44 34',
    '--card': '24 24 27',
    '--secondary': '39 39 42',
    '--secondary-foreground': '250 250 250',
    '--background': '9 9 11',
    '--popover': '24 24 27',
    '--popover-foreground': '250 250 250',
    '--muted': '39 39 42',
    '--muted-foreground': '161 161 170',
    '--destructive': '248 113 113',
    '--foreground': '250 250 250',
    '--border': '39 39 42',
    '--input': '63 63 70',
    '--ring': '52 211 153',
    '--accent': '39 39 42',
    '--accent-foreground': '250 250 250',
    '--income': '74 222 128',
    '--expense': '251 113 133',
    '--transfer': '96 165 250',
  },
};

// Config for nativewind vars() - used by provider
export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};
