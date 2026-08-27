/**
 * Design tokens shared by the web (Tailwind) and mobile (NativeWind) apps.
 * Keep every value here expressible on both platforms: no CSS-only features
 * such as gradients, filters or pseudo-selectors.
 *
 * The gradient the balance panel uses is the one exception, and it is not
 * expressed here — `GradientSurface` in packages/ui renders it per platform
 * from the `brand` stops below, because a gradient cannot be a class name on
 * native.
 *
 * @type {import('tailwindcss').Config['theme']}
 */
const theme = {
  extend: {
    colors: {
      // Teal, dark at the bottom of the ramp so 900 and 500 can serve as the
      // two stops of the balance gradient.
      brand: {
        50: '#eefbf7',
        100: '#d2f5ec',
        200: '#a6ead9',
        300: '#6ddac2',
        400: '#35c2a5',
        500: '#16a085',
        600: '#0f8570',
        700: '#0d6a5b',
        800: '#0b4f45',
        900: '#062b25',
      },
      /**
       * The call-to-action fill. Bright enough that its label has to be dark
       * rather than white — a white label on this fails contrast, which is why
       * the primary button's text colour is `content` and not `content-inverse`.
       */
      accent: {
        DEFAULT: '#5fefd8',
        strong: '#3fe3c7',
        muted: '#bff7ec',
      },
      surface: {
        DEFAULT: '#ffffff',
        muted: '#f2f2f4',
        inverse: '#062b25',
      },
      content: {
        DEFAULT: '#101820',
        muted: '#6b7280',
        inverse: '#ffffff',
      },
      /** Money coming in. Spending is left as ordinary content colour. */
      positive: '#0b8a3d',
      /** Secondary actions that are not buttons — filters, inline links. */
      link: '#2563eb',
    },
    borderRadius: {
      card: '20px',
      tile: '14px',
      pill: '9999px',
    },
    spacing: {
      gutter: '16px',
    },
  },
};

/** Content globs for the shared UI package, resolved from an app directory. */
const uiContent = ['../../packages/ui/src/**/*.{ts,tsx}'];

module.exports = { theme, uiContent };
