// src/features/builder/BuilderTabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoteDelegationTab } from './tabs/VoteDelegationTab';
import { DRepRegistrationTab } from './tabs/DRepRegistrationTab';
import { DRepUpdateTab } from './tabs/DRepUpdateTab';
import { DRepRetirementTab } from './tabs/DRepRetirementTab';
import { VoteTab } from './tabs/VoteTab';

export function BuilderTabs() {
  return (
    <Tabs defaultValue="vote-delegation" className="h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="vote-delegation">Vote Delegation</TabsTrigger>
        <TabsTrigger value="drep-registration">DRep Registration</TabsTrigger>
        <TabsTrigger value="drep-update">DRep Update</TabsTrigger>
        <TabsTrigger value="drep-retirement">DRep Retirement</TabsTrigger>
        <TabsTrigger value="vote">Vote</TabsTrigger>
      </TabsList>
      
      <div className="flex-1 overflow-hidden mt-4">
        <TabsContent value="vote-delegation" className="h-full">
          <VoteDelegationTab />
        </TabsContent>
        <TabsContent value="drep-registration" className="h-full">
          <DRepRegistrationTab />
        </TabsContent>
        <TabsContent value="drep-update" className="h-full">
          <DRepUpdateTab />
        </TabsContent>
        <TabsContent value="drep-retirement" className="h-full">
          <DRepRetirementTab />
        </TabsContent>
        <TabsContent value="vote" className="h-full">
          <VoteTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}

