// src/features/inspector/InspectorTabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DomainTx } from '@/domain/tx';
import { OverviewTab } from './tabs/OverviewTab';
import { IoValueTab } from './tabs/IoValueTab';
import { MetadataTab } from './tabs/MetadataTab';
import { RawTab } from './tabs/RawTab';
// import { ValidationTab } from './tabs/ValidationTab'; // Hidden for now
import { ScriptsTab } from './tabs/ScriptsTab';
// import { ComparisonTab } from './tabs/ComparisonTab'; // Hidden for now
import { SearchTab } from './tabs/SearchTab';
import { ContentsTab } from './tabs/ContentsTab';
import { useAppStore } from '@/lib/store';

interface InspectorTabsProps {
  tx: DomainTx;
  txHex: string;
}

export function InspectorTabs({ tx, txHex }: InspectorTabsProps) {
  const isOnChain = useAppStore(s => s.isOnChain);

  return (
    <div className="h-full">
      <Tabs defaultValue="overview" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="io-value">I/O & Value</TabsTrigger>
          <TabsTrigger value="contents">Contents</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="cbor">Raw</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full">
            <OverviewTab tx={tx} />
          </TabsContent>
          <TabsContent value="io-value" className="h-full">
            <IoValueTab tx={tx} />
          </TabsContent>
          <TabsContent value="contents" className="h-full">
            <ContentsTab tx={tx} />
          </TabsContent>
          <TabsContent value="metadata" className="h-full">
            <MetadataTab tx={tx} />
          </TabsContent>
          <TabsContent value="scripts" className="h-full">
            <ScriptsTab tx={tx} txHex={txHex} isOnChain={isOnChain} />
          </TabsContent>
          <TabsContent value="cbor" className="h-full">
            <RawTab tx={tx} txHex={txHex} />
          </TabsContent>
          <TabsContent value="search" className="h-full">
            <SearchTab tx={tx} txHex={txHex} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
