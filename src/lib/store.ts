// src/lib/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DomainTx, Network, TxParseResult } from '@/domain/tx';
import { BlockExplorerId } from '@/lib/types/block-explorer';
import { EvalResponse } from '@/lib/types/script-eval';

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

  // Eval cache (not persisted)
  evalCache: Record<string, EvalResponse>;

  // Theme
  theme: 'light' | 'dark' | 'system';

  // Block explorer preference
  blockExplorer: BlockExplorerId;

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
  setEvalCache: (key: string, result: EvalResponse) => void;
  getEvalCache: (key: string) => EvalResponse | null;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setBlockExplorer: (explorer: BlockExplorerId) => void;
  clearTx: () => void;
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
      evalCache: {},
      theme: 'system',
      blockExplorer: 'cardanoscan',

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
        activeTab: 'overview'
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
