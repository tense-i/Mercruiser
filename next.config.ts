import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.NEXT_BUILD_STANDALONE === '1' ? 'standalone' : undefined,
};

export default nextConfig;
