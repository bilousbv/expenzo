import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared packages ship TypeScript source, so Next must compile them.
  transpilePackages: ['@expenzo/ui', '@expenzo/domain'],
};

export default nextConfig;
