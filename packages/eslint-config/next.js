import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

import { baseConfig } from './base.js';

/** @type {import("eslint").Linter.Config[]} */
export const nextConfig = [...baseConfig, ...nextCoreWebVitals];

export default nextConfig;
