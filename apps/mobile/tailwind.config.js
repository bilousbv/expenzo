const { theme, uiContent } = require('@expenzo/tailwind-config/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // App.tsx is gone; everything now lives under src, including the route tree.
  content: ['./src/**/*.{ts,tsx}', ...uiContent],
  // NativeWind drives this class from its colour scheme, the same strategy the
  // web app uses with a server-written class on <html>.
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme,
  plugins: [],
};
