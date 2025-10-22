// src/features/inspector/InspectorTabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DomainTx } from '@/domain/tx';
import { OverviewTab } from './tabs/OverviewTab';
import { IoValueTab } from './tabs/IoValueTab';
import { MetadataTab } from './tabs/MetadataTab';

interface InspectorTabsProps {
  tx: DomainTx;
}

export function InspectorTabs({ tx }: InspectorTabsProps) {
  return (
    <div className="h-full">
      <Tabs defaultValue="overview" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="io-value">I/O & Value</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full">
            <OverviewTab tx={tx} />
          </TabsContent>
          <TabsContent value="io-value" className="h-full">
            <IoValueTab tx={tx} />
          </TabsContent>
          <TabsContent value="metadata" className="h-full">
            <MetadataTab tx={tx} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
