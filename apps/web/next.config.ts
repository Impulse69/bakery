import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@bakery/ui', '@bakery/types', '@bakery/utils'],
};

export default nextConfig;
