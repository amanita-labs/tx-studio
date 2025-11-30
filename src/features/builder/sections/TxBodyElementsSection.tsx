// src/features/builder/sections/TxBodyElementsSection.tsx
'use client';

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, ArrowRight, ArrowLeft, Shield, BookOpen, RotateCcw, Coins, Clock, Wallet, Hash, Code, Key, Vote, FileText, Banknote, Gift } from 'lucide-react';
import { TransactionInputsTab } from '../tabs/tx-body/inputs/TransactionInputsTab';
import { CollateralInputsTab } from '../tabs/tx-body/inputs/CollateralInputsTab';
import { ReferenceInputsTab } from '../tabs/tx-body/inputs/ReferenceInputsTab';
import { TransactionOutputsTab } from '../tabs/tx-body/outputs/TransactionOutputsTab';
import { CollateralReturnTab } from '../tabs/tx-body/outputs/CollateralReturnTab';
import { FeeTab } from '../tabs/tx-body/fees/FeeTab';
import { ValidityIntervalStartTab } from '../tabs/tx-body/fees/ValidityIntervalStartTab';
import { ValidityIntervalEndTab } from '../tabs/tx-body/fees/ValidityIntervalEndTab';
import { TotalCollateralTab } from '../tabs/tx-body/fees/TotalCollateralTab';
import { WithdrawalsTab } from '../tabs/tx-body/withdrawals/WithdrawalsTab';
import { MintTab } from '../tabs/tx-body/minting/MintTab';
import { AuxiliaryDataHashTab } from '../tabs/tx-body/metadata/AuxiliaryDataHashTab';
import { ScriptDataHashTab } from '../tabs/tx-body/metadata/ScriptDataHashTab';
import { RequiredSignersTab } from '../tabs/tx-body/signers/RequiredSignersTab';
import { VotingProceduresTab } from '../tabs/tx-body/governance/VotingProceduresTab';
import { ProposalProceduresTab } from '../tabs/tx-body/governance/ProposalProceduresTab';
import { TreasuryAmountTab } from '../tabs/tx-body/treasury/TreasuryAmountTab';
import { TreasuryDonationTab } from '../tabs/tx-body/treasury/TreasuryDonationTab';

type TxBodyElementType =
  | 'transaction-inputs'
  | 'collateral-inputs'
  | 'reference-inputs'
  | 'transaction-outputs'
  | 'collateral-return'
  | 'fee'
  | 'validity-interval-start'
  | 'validity-interval-end'
  | 'total-collateral'
  | 'withdrawals'
  | 'mint'
  | 'auxiliary-data-hash'
  | 'script-data-hash'
  | 'required-signers'
  | 'voting-procedures'
  | 'proposal-procedures'
  | 'treasury-amount'
  | 'treasury-donation';

const txBodyElementGroups = [
  {
    name: 'Inputs & Outputs',
    items: [
      { id: 'transaction-inputs' as TxBodyElementType, label: 'Transaction Inputs', icon: ArrowRight },
      { id: 'collateral-inputs' as TxBodyElementType, label: 'Collateral Inputs', icon: Shield },
      { id: 'reference-inputs' as TxBodyElementType, label: 'Reference Inputs', icon: BookOpen },
      { id: 'transaction-outputs' as TxBodyElementType, label: 'Transaction Outputs', icon: ArrowLeft },
      { id: 'collateral-return' as TxBodyElementType, label: 'Collateral Return', icon: RotateCcw },
    ]
  },
  {
    name: 'Fees & Validity',
    items: [
      { id: 'fee' as TxBodyElementType, label: 'Fee', icon: Coins },
      { id: 'validity-interval-start' as TxBodyElementType, label: 'Validity Start', icon: Clock },
      { id: 'validity-interval-end' as TxBodyElementType, label: 'Validity End', icon: Clock },
      { id: 'total-collateral' as TxBodyElementType, label: 'Total Collateral', icon: Shield },
    ]
  },
  {
    name: 'Withdrawals & Minting',
    items: [
      { id: 'withdrawals' as TxBodyElementType, label: 'Withdrawals', icon: Wallet },
      { id: 'mint' as TxBodyElementType, label: 'Mint', icon: Coins },
    ]
  },
  {
    name: 'Metadata & Scripts',
    items: [
      { id: 'auxiliary-data-hash' as TxBodyElementType, label: 'Auxiliary Data Hash', icon: Hash },
      { id: 'script-data-hash' as TxBodyElementType, label: 'Script Data Hash', icon: Code },
    ]
  },
  {
    name: 'Signers',
    items: [
      { id: 'required-signers' as TxBodyElementType, label: 'Required Signers', icon: Key },
    ]
  },
  {
    name: 'Governance',
    items: [
      { id: 'voting-procedures' as TxBodyElementType, label: 'Voting Procedures', icon: Vote },
      { id: 'proposal-procedures' as TxBodyElementType, label: 'Proposal Procedures', icon: FileText },
    ]
  },
  {
    name: 'Treasury',
    items: [
      { id: 'treasury-amount' as TxBodyElementType, label: 'Treasury Amount', icon: Banknote },
      { id: 'treasury-donation' as TxBodyElementType, label: 'Treasury Donation', icon: Gift },
    ]
  },
];

const txBodyElementComponents: Record<TxBodyElementType, React.ComponentType> = {
  'transaction-inputs': TransactionInputsTab,
  'collateral-inputs': CollateralInputsTab,
  'reference-inputs': ReferenceInputsTab,
  'transaction-outputs': TransactionOutputsTab,
  'collateral-return': CollateralReturnTab,
  'fee': FeeTab,
  'validity-interval-start': ValidityIntervalStartTab,
  'validity-interval-end': ValidityIntervalEndTab,
  'total-collateral': TotalCollateralTab,
  'withdrawals': WithdrawalsTab,
  'mint': MintTab,
  'auxiliary-data-hash': AuxiliaryDataHashTab,
  'script-data-hash': ScriptDataHashTab,
  'required-signers': RequiredSignersTab,
  'voting-procedures': VotingProceduresTab,
  'proposal-procedures': ProposalProceduresTab,
  'treasury-amount': TreasuryAmountTab,
  'treasury-donation': TreasuryDonationTab,
};

export function TxBodyElementsSection() {
  const [selectedElement, setSelectedElement] = useState<TxBodyElementType>('transaction-inputs');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Inputs & Outputs': true,
    'Fees & Validity': true,
    'Withdrawals & Minting': false,
    'Metadata & Scripts': false,
    'Signers': false,
    'Governance': false,
    'Treasury': false,
  });

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const SelectedComponent = txBodyElementComponents[selectedElement];

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Transaction Body Elements</h3>
          <p className="text-xs text-muted-foreground mt-1">Select an element to add</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {txBodyElementGroups.map((group) => (
              <Collapsible
                key={group.name}
                open={openGroups[group.name]}
                onOpenChange={() => toggleGroup(group.name)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-xs font-medium"
                    size="sm"
                  >
                    <span>{group.name}</span>
                    {openGroups[group.name] ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-2 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Button
                          key={item.id}
                          variant={selectedElement === item.id ? 'secondary' : 'ghost'}
                          className="w-full justify-start text-xs h-8"
                          size="sm"
                          onClick={() => setSelectedElement(item.id)}
                        >
                          <Icon className="h-3 w-3 mr-2" />
                          <span className="truncate">{item.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {SelectedComponent && <SelectedComponent />}
      </div>
    </div>
  );
}
