import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT === 'true'
    ? { output: 'export' }
    : {}
  ),
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  // We force webpack for both dev and build (`next dev --webpack`,
  // `next build --webpack`) because Turbopack's runtime can't resolve
  // relative `/_next/...wasm` URLs from inside a module worker — the
  // WorkerGlobalScope has no base URL to combine with the path. Webpack's
  // asyncWebAssembly experiment inlines the wasm import correctly so the
  // wasm-bindgen browser build of cardano-serialization-lib works in both
  // dev and production.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
