import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Conditional export: use static export for GitHub Pages, but allow API routes for Vercel/dev
  // API routes require dynamic rendering, so disable static export when:
  // - Running in development mode
  // - Deployed to Vercel (which supports API routes)
  // Only use static export for GitHub Pages production builds
  ...(process.env.VERCEL || process.env.NODE_ENV === 'development' 
    ? {} 
    : { output: 'export' }
  ),
  distDir: 'out',
  basePath: process.env.NODE_ENV === 'production' && !process.env.VERCEL ? '/tx-studio' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
