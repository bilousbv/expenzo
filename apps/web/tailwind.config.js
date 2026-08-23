const { theme, uiContent } = require('@expenzo/tailwind-config/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', ...uiContent],
  theme,
  plugins: [],
};
