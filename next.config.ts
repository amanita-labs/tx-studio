import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

function getBuildInfo() {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, 'package.json'), 'utf8')
  ) as { version: string };

  let commit = 'dev';
  try {
    commit = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    // No git available — keep 'dev' fallback.
  }

  return { version: pkg.version, commit };
}

const { version: appVersion, commit: gitCommit } = getBuildInfo();

const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT === 'true'
    ? { output: 'export' }
    : {}
  ),
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
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
