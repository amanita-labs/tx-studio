// src/features/builder/sections/CertificatesSection.tsx
'use client';

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, UserPlus, UserMinus, Users, Building2, Trash2, UserCheck, UserX, Vote, Shield, ShieldX, RefreshCw } from 'lucide-react';
import { VoteDelegationTab } from '../tabs/certificates/VoteDelegationTab';
import { DRepRegistrationTab } from '../tabs/certificates/DRepRegistrationTab';
import { DRepUpdateTab } from '../tabs/certificates/DRepUpdateTab';
import { DRepRetirementTab } from '../tabs/certificates/DRepRetirementTab';
import { VoteTab } from '../tabs/certificates/VoteTab';
import { StakeRegistrationTab } from '../tabs/certificates/StakeRegistrationTab';
import { StakeDeregistrationTab } from '../tabs/certificates/StakeDeregistrationTab';
import { StakeDelegationTab } from '../tabs/certificates/StakeDelegationTab';
import { PoolRegistrationTab } from '../tabs/certificates/PoolRegistrationTab';
import { PoolRetirementTab } from '../tabs/certificates/PoolRetirementTab';
import { AccountRegistrationTab } from '../tabs/certificates/AccountRegistrationTab';
import { AccountUnregistrationTab } from '../tabs/certificates/AccountUnregistrationTab';
import { StakeVoteDelegationTab } from '../tabs/certificates/StakeVoteDelegationTab';
import { StakeRegDelegationTab } from '../tabs/certificates/StakeRegDelegationTab';
import { VoteRegDelegationTab } from '../tabs/certificates/VoteRegDelegationTab';
import { StakeVoteRegDelegationTab } from '../tabs/certificates/StakeVoteRegDelegationTab';
import { CommitteeAuthTab } from '../tabs/certificates/CommitteeAuthTab';
import { CommitteeResignationTab } from '../tabs/certificates/CommitteeResignationTab';

type CertificateType = 
  | 'stake-registration'
  | 'stake-deregistration'
  | 'stake-delegation'
  | 'pool-registration'
  | 'pool-retirement'
  | 'account-registration'
  | 'account-unregistration'
  | 'vote-delegation'
  | 'stake-vote-delegation'
  | 'stake-reg-delegation'
  | 'vote-reg-delegation'
  | 'stake-vote-reg-delegation'
  | 'committee-auth'
  | 'committee-resignation'
  | 'drep-registration'
  | 'drep-update'
  | 'drep-retirement'
  | 'vote';

const certificateGroups = [
  {
    name: 'Stake Operations',
    items: [
      { id: 'stake-registration' as CertificateType, label: 'Stake Registration', icon: UserPlus },
      { id: 'stake-deregistration' as CertificateType, label: 'Stake Deregistration', icon: UserMinus },
      { id: 'stake-delegation' as CertificateType, label: 'Stake Delegation', icon: Users },
    ]
  },
  {
    name: 'Pool Operations',
    items: [
      { id: 'pool-registration' as CertificateType, label: 'Pool Registration', icon: Building2 },
      { id: 'pool-retirement' as CertificateType, label: 'Pool Retirement', icon: Trash2 },
    ]
  },
  {
    name: 'Account Operations',
    items: [
      { id: 'account-registration' as CertificateType, label: 'Account Registration', icon: UserCheck },
      { id: 'account-unregistration' as CertificateType, label: 'Account Unregistration', icon: UserX },
    ]
  },
  {
    name: 'Vote & Delegation',
    items: [
      { id: 'vote-delegation' as CertificateType, label: 'Vote Delegation', icon: Vote },
      { id: 'vote' as CertificateType, label: 'Vote', icon: Vote },
    ]
  },
  {
    name: 'Combined Certificates',
    items: [
      { id: 'stake-vote-delegation' as CertificateType, label: 'Stake + Vote Delegation', icon: Users },
      { id: 'stake-reg-delegation' as CertificateType, label: 'Stake Reg + Delegation', icon: UserPlus },
      { id: 'vote-reg-delegation' as CertificateType, label: 'Vote Reg + Delegation', icon: Vote },
      { id: 'stake-vote-reg-delegation' as CertificateType, label: 'Stake + Vote + Reg + Delegation', icon: Users },
    ]
  },
  {
    name: 'Committee',
    items: [
      { id: 'committee-auth' as CertificateType, label: 'Committee Authorization', icon: Shield },
      { id: 'committee-resignation' as CertificateType, label: 'Committee Resignation', icon: ShieldX },
    ]
  },
  {
    name: 'DRep Operations',
    items: [
      { id: 'drep-registration' as CertificateType, label: 'DRep Registration', icon: UserPlus },
      { id: 'drep-update' as CertificateType, label: 'DRep Update', icon: RefreshCw },
      { id: 'drep-retirement' as CertificateType, label: 'DRep Retirement', icon: UserMinus },
    ]
  },
];

const certificateComponents: Record<CertificateType, React.ComponentType> = {
  'stake-registration': StakeRegistrationTab,
  'stake-deregistration': StakeDeregistrationTab,
  'stake-delegation': StakeDelegationTab,
  'pool-registration': PoolRegistrationTab,
  'pool-retirement': PoolRetirementTab,
  'account-registration': AccountRegistrationTab,
  'account-unregistration': AccountUnregistrationTab,
  'vote-delegation': VoteDelegationTab,
  'stake-vote-delegation': StakeVoteDelegationTab,
  'stake-reg-delegation': StakeRegDelegationTab,
  'vote-reg-delegation': VoteRegDelegationTab,
  'stake-vote-reg-delegation': StakeVoteRegDelegationTab,
  'committee-auth': CommitteeAuthTab,
  'committee-resignation': CommitteeResignationTab,
  'drep-registration': DRepRegistrationTab,
  'drep-update': DRepUpdateTab,
  'drep-retirement': DRepRetirementTab,
  'vote': VoteTab,
};

export function CertificatesSection() {
  const [selectedCert, setSelectedCert] = useState<CertificateType>('stake-registration');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Stake Operations': true,
    'Pool Operations': true,
    'Account Operations': true,
    'Vote & Delegation': true,
    'Combined Certificates': false,
    'Committee': false,
    'DRep Operations': true,
  });

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const SelectedComponent = certificateComponents[selectedCert];

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Certificate Types</h3>
          <p className="text-xs text-muted-foreground mt-1">Select a certificate to add</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {certificateGroups.map((group) => (
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
                          variant={selectedCert === item.id ? 'secondary' : 'ghost'}
                          className="w-full justify-start text-xs h-8"
                          size="sm"
                          onClick={() => setSelectedCert(item.id)}
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
