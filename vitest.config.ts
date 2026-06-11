import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Project import alias (mirrors tsconfig "@/*" -> "src/*").
      '@': src,
      // The app ships the browser WASM build, which doesn't load cleanly under
      // Node. The nodejs build is generated from the same Rust source and has an
      // identical API, so we swap it in for tests only.
      '@emurgo/cardano-serialization-lib-browser': '@emurgo/cardano-serialization-lib-nodejs',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
