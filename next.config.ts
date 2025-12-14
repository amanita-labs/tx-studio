import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Conditional export: use static export for GitHub Pages, but allow API routes in development
  // API routes require dynamic rendering, so disable static export in development mode
  // Only use static export for GitHub Pages production builds
  ...(process.env.NODE_ENV === 'development' 
    ? {} 
    : { output: 'export' }
  ),
  distDir: 'out',
  basePath: process.env.NODE_ENV === 'production' ? '/tx-studio' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
