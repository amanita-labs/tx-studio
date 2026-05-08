// src/app/build/page.tsx
'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// CSL/Mesh load WASM at module-import time, which fails during static
// prerender. Defer the import to the client to avoid touching WASM on
// the server.
const TxBuilder = dynamic(
  () => import('@/features/builder/TxBuilder').then((m) => m.TxBuilder),
  { ssr: false }
);

export default function BuildPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading Transaction Builder...</p>
          </div>
        </div>
      }>
        <TxBuilder />
      </Suspense>
    </div>
  );
}
