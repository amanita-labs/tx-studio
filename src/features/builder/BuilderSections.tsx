// src/features/builder/BuilderSections.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CertificatesSection } from './sections/CertificatesSection';
import { TxBodyElementsSection } from './sections/TxBodyElementsSection';
import { FileText, Settings } from 'lucide-react';

export function BuilderSections() {
  return (
    <Tabs defaultValue="certificates" className="h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="certificates" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Certificates
        </TabsTrigger>
        <TabsTrigger value="tx-body-elements" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Transaction Body Elements
        </TabsTrigger>
      </TabsList>
      
      <div className="flex-1 overflow-hidden">
        <TabsContent value="certificates" className="h-full m-0">
          <CertificatesSection />
        </TabsContent>
        <TabsContent value="tx-body-elements" className="h-full m-0">
          <TxBodyElementsSection />
        </TabsContent>
      </div>
    </Tabs>
  );
}

