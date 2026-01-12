import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT === 'true' 
    ? { output: 'export' }
    : {}
  ),
  distDir: 'out',
  basePath: '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
