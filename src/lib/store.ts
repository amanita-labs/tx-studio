// src/lib/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DomainTx, Network, TxParseResult } from '@/domain/tx';

interface AppState {
  // Transaction data
  txHex: string;
  parsedTx: TxParseResult | null;
  network: Network;
  
  // UI state
  activeTab: string;
  isLoading: boolean;
  error: string | null;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
  
  // Actions
  setTxHex: (hex: string) => void;
  setParsedTx: (result: TxParseResult | null) => void;
  setNetwork: (network: Network) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
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
      error: null,
      theme: 'system',
      
      // Actions
      setTxHex: (hex: string) => set({ txHex: hex }),
      setParsedTx: (result: TxParseResult | null) => set({ parsedTx: result }),
      setNetwork: (network: Network) => set({ network }),
      setActiveTab: (tab: string) => set({ activeTab: tab }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
      setTheme: (theme: 'light' | 'dark' | 'system') => set({ theme }),
      clearTx: () => set({ 
        txHex: '', 
        parsedTx: null, 
        error: null,
        activeTab: 'overview'
      }),
    }),
    {
      name: 'tx-inspector-storage',
      partialize: (state) => ({
        theme: state.theme,
        network: state.network,
      }),
    }
  )
);
