const { theme, uiContent } = require('@expenzo/tailwind-config/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // App.tsx is gone; everything now lives under src, including the route tree.
  content: ['./src/**/*.{ts,tsx}', ...uiContent],
  presets: [require('nativewind/preset')],
  theme,
  plugins: [],
};
