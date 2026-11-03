/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/app/**/*.{js,jsx,ts,tsx}', './src/lib/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  important: 'html',
  // Theme tokens are CSS variables set by GluestackUIProvider
  // (src/lib/gluestack-ui/gluestack-ui-provider/config.ts).
  theme: {
    extend: {
      // Poppins is embedded by the expo-font plugin (app.json) as one family with
      // 400/500/600/700 faces, so font-normal … font-bold pick the matching face.
      fontFamily: {
        sans: ['Poppins'],
        body: ['Poppins'],
        heading: ['Poppins'],
      },
      // Bold (700) is the heaviest weight in the app; heavier classes render as bold.
      fontWeight: {
        extrabold: '700',
        black: '700',
      },
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        popover: {
          DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: 'rgb(var(--destructive) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        sky: 'rgb(var(--sky) / <alpha-value>)',
        income: 'rgb(var(--income) / <alpha-value>)',
        expense: 'rgb(var(--expense) / <alpha-value>)',
        transfer: 'rgb(var(--transfer) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
