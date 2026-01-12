import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT === 'true' 
    ? { output: 'export' }
    : {}
  ),
  distDir: 'out',
  basePath: process.env.NODE_ENV === 'production' ? '/tx-studio' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
