// src/features/inspector/InspectorTabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DomainTx } from '@/domain/tx';
import { OverviewTab } from './tabs/OverviewTab';
import { IoValueTab } from './tabs/IoValueTab';
import { MetadataTab } from './tabs/MetadataTab';
import { CBORTab } from './tabs/CBORTab';
// import { ValidationTab } from './tabs/ValidationTab'; // Hidden for now
import { ScriptsTab } from './tabs/ScriptsTab';
import { ComparisonTab } from './tabs/ComparisonTab';
import { SearchTab } from './tabs/SearchTab';
import { ContentsTab } from './tabs/ContentsTab';

interface InspectorTabsProps {
  tx: DomainTx;
  txHex: string;
}

export function InspectorTabs({ tx, txHex }: InspectorTabsProps) {
  return (
    <div className="h-full">
      <Tabs defaultValue="overview" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="io-value">I/O & Value</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="cbor">CBOR</TabsTrigger>
          {/* <TabsTrigger value="validation">Validation</TabsTrigger> Hidden for now */}
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="contents">Contents</TabsTrigger>
          <TabsTrigger value="comparison">Compare</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
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
          <TabsContent value="cbor" className="h-full">
            <CBORTab txHex={txHex} />
          </TabsContent>
          {/* <TabsContent value="validation" className="h-full">
            <ValidationTab tx={tx} txHex={txHex} />
          </TabsContent> Hidden for now */}
          <TabsContent value="scripts" className="h-full">
            <ScriptsTab tx={tx} />
          </TabsContent>
          <TabsContent value="contents" className="h-full">
            <ContentsTab tx={tx} />
          </TabsContent>
          <TabsContent value="comparison" className="h-full">
            <ComparisonTab tx={tx} txHex={txHex} />
          </TabsContent>
          <TabsContent value="search" className="h-full">
            <SearchTab tx={tx} txHex={txHex} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
