// src/app/tx/page.tsx
'use client';

import { Suspense } from 'react';
import { TxInspector } from '@/features/inspector/TxInspector';

export default function TxPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div>Loading...</div>}>
        <TxInspector />
      </Suspense>
    </div>
  );
}
