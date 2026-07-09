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
import { GovernanceTab } from './tabs/GovernanceTab';
import { txHasGovernanceAnchors } from '@/lib/governance-metadata/collect-anchors';
import { useAppStore } from '@/lib/store';

interface InspectorTabsProps {
  tx: DomainTx;
  txHex: string;
}

export function InspectorTabs({ tx, txHex }: InspectorTabsProps) {
  const isOnChain = useAppStore(s => s.isOnChain);
  const showGovernance = txHasGovernanceAnchors(tx);

  // Single source of truth for the trigger row — the grid column count is
  // derived from this list, so adding/removing a tab can't drift out of sync.
  const triggers = [
    { value: 'overview', label: 'Overview' },
    { value: 'io-value', label: 'I/O & Value' },
    { value: 'contents', label: 'Contents' },
    ...(showGovernance ? [{ value: 'governance', label: 'Gov Anchor' }] : []),
    { value: 'metadata', label: 'Metadata' },
    { value: 'scripts', label: 'Scripts' },
    { value: 'cbor', label: 'Raw' },
    { value: 'search', label: 'Search' },
  ];

  return (
    <div className="h-full">
      <Tabs defaultValue="overview" className="h-full flex flex-col">
        <TabsList
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${triggers.length}, minmax(0, 1fr))` }}
        >
          {triggers.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
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
          {showGovernance && (
            <TabsContent value="governance" className="h-full">
              <GovernanceTab tx={tx} txHex={txHex} />
            </TabsContent>
          )}
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
