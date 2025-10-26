import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  basePath: process.env.NODE_ENV === 'production' ? '/tx-studio' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
