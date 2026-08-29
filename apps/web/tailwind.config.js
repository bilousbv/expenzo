const { theme, uiContent } = require('@expenzo/tailwind-config/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', ...uiContent],
  // The scheme is a class on the root element, written by the server from a
  // cookie, rather than a media query: the choice is the user's and has to
  // survive their operating system disagreeing with it.
  darkMode: 'class',
  theme,
  plugins: [],
};
