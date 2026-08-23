const { theme, uiContent } = require('@expenzo/tailwind-config/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}', ...uiContent],
  presets: [require('nativewind/preset')],
  theme,
  plugins: [],
};
