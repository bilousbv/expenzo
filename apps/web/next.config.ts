import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared package ships TypeScript source, so Next must compile it.
  transpilePackages: ['@expenzo/ui'],
};

export default nextConfig;
