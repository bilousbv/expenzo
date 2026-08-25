import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared packages ship TypeScript source, so Next must compile them.
  transpilePackages: ['@expenzo/ui', '@expenzo/data', '@expenzo/domain', '@expenzo/supabase-types'],
};

export default nextConfig;
