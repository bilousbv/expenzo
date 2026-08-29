/**
 * Design tokens shared by the web (Tailwind) and mobile (NativeWind) apps.
 * Keep every value here expressible on both platforms: no CSS-only features
 * such as filters or pseudo-selectors.
 *
 * Every colour is a CSS variable rather than a literal, because the app ships
 * two schemes and swaps them by redefining those variables on the root element.
 * That is what lets one set of class names — `bg-surface`, `text-content` —
 * serve both, on both platforms, without a `dark:` variant on every element.
 *
 * The channels are unwrapped (`255 201 60`, not `#ffc93c`) so Tailwind can
 * insert an alpha of its own; a hex string in the variable makes every opacity
 * modifier such as `bg-surface/40` silently do nothing.
 *
 * The values live in packages/ui/src/palette.ts, which is where they are
 * tested — for contrast, and for the two schemes defining the same tokens.
 *
 * The gradient the balance panel uses is the one thing not expressed here:
 * `GradientSurface` in packages/ui renders it per platform, because a gradient
 * cannot be a class name on native.
 *
 * @type {import('tailwindcss').Config['theme']}
 */

/** `rgb(var(--color-x) / <alpha-value>)`, so opacity modifiers keep working. */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

const theme = {
  extend: {
    colors: {
      background: token('background'),
      surface: {
        DEFAULT: token('surface'),
        muted: token('surface-muted'),
      },
      border: token('border'),
      content: {
        DEFAULT: token('content'),
        muted: token('content-muted'),
        inverse: token('content-inverse'),
        /**
         * The amber action colour is bright enough that a white label on it
         * fails contrast, so the primary button's label is this rather than
         * `content-inverse`. `button.styles.test.ts` asserts it.
         */
        'on-accent': token('content-on-accent'),
      },
      brand: {
        DEFAULT: token('brand'),
        muted: token('brand-muted'),
      },
      /** The call to action: the add button, save, every progress bar. */
      accent: {
        DEFAULT: token('accent'),
        muted: token('accent-muted'),
      },
      /** Money arriving. */
      positive: token('positive'),
      /** Money leaving, and overspend. */
      negative: token('negative'),
      /** Secondary actions that are not buttons — filters, inline links. */
      link: token('link'),
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
