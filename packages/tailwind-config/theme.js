/**
 * Design tokens shared by the web (Tailwind) and mobile (NativeWind) apps.
 * Keep every value here expressible on both platforms: no CSS-only features
 * such as gradients, filters or pseudo-selectors.
 *
 * @type {import('tailwindcss').Config['theme']}
 */
const theme = {
  extend: {
    colors: {
      brand: {
        50: '#eef6ff',
        100: '#d9eaff',
        200: '#bcdaff',
        300: '#8ec3ff',
        400: '#59a1ff',
        500: '#337dff',
        600: '#1d5df5',
        700: '#1849e1',
        800: '#1a3db6',
        900: '#1b388f',
      },
      surface: {
        DEFAULT: '#ffffff',
        muted: '#f5f6f8',
        inverse: '#0b1220',
      },
      content: {
        DEFAULT: '#0b1220',
        muted: '#5b6675',
        inverse: '#ffffff',
      },
    },
    borderRadius: {
      card: '16px',
    },
    spacing: {
      gutter: '16px',
    },
  },
};

/** Content globs for the shared UI package, resolved from an app directory. */
const uiContent = ['../../packages/ui/src/**/*.{ts,tsx}'];

module.exports = { theme, uiContent };
