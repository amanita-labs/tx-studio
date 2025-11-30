// src/lib/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DomainTx, Network, TxParseResult } from '@/domain/tx';
import { BlockExplorerId } from '@/lib/types/block-explorer';
import { EvalResponse } from '@/lib/types/script-eval';

export interface OnChainMeta {
  block: string;       // block hash
  blockHeight: number;
  blockTime: number;   // unix timestamp (seconds)
  slot: number;
  index: number;       // tx position within block
}

export type BuilderCertificate = {
  id: string;
  type: 
    | 'StakeRegistration' 
    | 'StakeDeregistration' 
    | 'StakeDelegation' 
    | 'PoolRegistration' 
    | 'PoolRetirement' 
    | 'AccountRegistration' 
    | 'AccountUnregistration' 
    | 'VoteDelegation' 
    | 'StakeVoteDelegation' 
    | 'StakeRegDelegation' 
    | 'VoteRegDelegation' 
    | 'StakeVoteRegDelegation' 
    | 'CommitteeAuth' 
    | 'CommitteeResignation' 
    | 'DRepRegistration' 
    | 'DRepUpdate' 
    | 'DRepRetirement' 
    | 'Vote';
  data: Record<string, unknown>;
};

export type BuilderTxBodyElement = {
  id: string;
  type: 
    | 'TransactionInputs'
    | 'CollateralInputs'
    | 'ReferenceInputs'
    | 'TransactionOutputs'
    | 'CollateralReturn'
    | 'Fee'
    | 'ValidityIntervalStart'
    | 'ValidityIntervalEnd'
    | 'TotalCollateral'
    | 'Withdrawals'
    | 'Mint'
    | 'AuxiliaryDataHash'
    | 'ScriptDataHash'
    | 'RequiredSigners'
    | 'VotingProcedures'
    | 'ProposalProcedures'
    | 'TreasuryAmount'
    | 'TreasuryDonation';
  data: Record<string, unknown>;
};

interface AppState {
  // Transaction data
  txHex: string;
  parsedTx: TxParseResult | null;
  network: Network;

  // UI state
  activeTab: string;
  isLoading: boolean;
  isDetectingNetwork: boolean;
  networkDetected: boolean; // true if network was successfully detected, false if detection failed or not attempted
  error: string | null;
  isOnChain: boolean;
  onChainMeta: OnChainMeta | null;

  // Eval cache (not persisted)
  evalCache: Record<string, EvalResponse>;

  // Theme
  theme: 'light' | 'dark' | 'system';

  // Block explorer preference
  blockExplorer: BlockExplorerId;

  // Builder state
  builderCertificates: BuilderCertificate[];
  builderTxBodyElements: BuilderTxBodyElement[];
  walletConnected: boolean;
  walletName: string | null;
  walletApi: any | null; // BrowserWallet instance
  builtTxHex: string | null;
  signedTxHex: string | null;

  // Actions
  setTxHex: (hex: string) => void;
  setParsedTx: (result: TxParseResult | null) => void;
  setNetwork: (network: Network) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;
  setDetectingNetwork: (detecting: boolean) => void;
  setNetworkDetected: (detected: boolean) => void;
  setError: (error: string | null) => void;
  setIsOnChain: (isOnChain: boolean) => void;
  setOnChainMeta: (meta: OnChainMeta | null) => void;
  setEvalCache: (key: string, result: EvalResponse) => void;
  getEvalCache: (key: string) => EvalResponse | null;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setBlockExplorer: (explorer: BlockExplorerId) => void;
  clearTx: () => void;
  
  // Builder actions
  addCertificate: (cert: BuilderCertificate) => void;
  removeCertificate: (id: string) => void;
  addTxBodyElement: (element: BuilderTxBodyElement) => void;
  removeTxBodyElement: (id: string) => void;
  clearBuilder: () => void;
  setWalletApi: (api: any | null, name: string | null) => void;
  setBuiltTxHex: (hex: string | null) => void;
  setSignedTxHex: (hex: string | null) => void;
  disconnectWallet: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      txHex: '',
      parsedTx: null,
      network: 'mainnet',
      activeTab: 'overview',
      isLoading: false,
      isDetectingNetwork: false,
      networkDetected: false,
      error: null,
      isOnChain: false,
      onChainMeta: null,
      evalCache: {},
      theme: 'system',
      blockExplorer: 'cardanoscan',

      // Builder state
      builderCertificates: [],
      builderTxBodyElements: [],
      walletConnected: false,
      walletName: null,
      walletApi: null,
      builtTxHex: null,
      signedTxHex: null,

      // Actions
      setTxHex: (hex: string) => set({ txHex: hex }),
      setParsedTx: (result: TxParseResult | null) => set({ parsedTx: result }),
      setNetwork: (network: Network) => set({ network }),
      setActiveTab: (tab: string) => set({ activeTab: tab }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setDetectingNetwork: (detecting: boolean) => set({ isDetectingNetwork: detecting }),
      setNetworkDetected: (detected: boolean) => set({ networkDetected: detected }),
      setError: (error: string | null) => set({ error }),
      setIsOnChain: (isOnChain: boolean) => set({ isOnChain }),
      setOnChainMeta: (meta: OnChainMeta | null) => set({ onChainMeta: meta }),
      setEvalCache: (key: string, result: EvalResponse) => set((state) => ({
        evalCache: { ...state.evalCache, [key]: result },
      })),
      getEvalCache: (key: string) => get().evalCache[key] || null,
      setTheme: (theme: 'light' | 'dark' | 'system') => set({ theme }),
      setBlockExplorer: (explorer: BlockExplorerId) => set({ blockExplorer: explorer }),
      clearTx: () => set({
        txHex: '',
        parsedTx: null,
        error: null,
        isDetectingNetwork: false,
        networkDetected: false,
        isOnChain: false,
        onChainMeta: null,
        activeTab: 'overview'
      }),
      
      // Builder actions
      addCertificate: (cert: BuilderCertificate) => set((state) => ({
        builderCertificates: [...state.builderCertificates, cert]
      })),
      removeCertificate: (id: string) => set((state) => ({
        builderCertificates: state.builderCertificates.filter(c => c.id !== id)
      })),
      addTxBodyElement: (element: BuilderTxBodyElement) => set((state) => ({
        builderTxBodyElements: [...state.builderTxBodyElements, element]
      })),
      removeTxBodyElement: (id: string) => set((state) => ({
        builderTxBodyElements: state.builderTxBodyElements.filter(e => e.id !== id)
      })),
      clearBuilder: () => set({
        builderCertificates: [],
        builderTxBodyElements: [],
        builtTxHex: null,
        signedTxHex: null,
      }),
      setWalletApi: (api: any | null, name: string | null) => set({
        walletApi: api,
        walletName: name,
        walletConnected: api !== null,
      }),
      setBuiltTxHex: (hex: string | null) => set({ builtTxHex: hex }),
      setSignedTxHex: (hex: string | null) => set({ signedTxHex: hex }),
      disconnectWallet: () => set({
        walletApi: null,
        walletName: null,
        walletConnected: false,
        builtTxHex: null,
        signedTxHex: null,
      }),
    }),
    {
      name: 'tx-inspector-storage',
      partialize: (state) => ({
        theme: state.theme,
        network: state.network,
        blockExplorer: state.blockExplorer,
      }),
    }
  )
);
