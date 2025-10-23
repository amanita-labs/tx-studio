// src/app/page.tsx
'use client';

import { Suspense } from 'react';
import { TxInspector } from '@/features/inspector/TxInspector';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading Inspector...</p>
          </div>
        </div>
      }>
        <TxInspector />
      </Suspense>
    </div>
  );
}