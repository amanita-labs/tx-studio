// src/lib/wallet-connector.ts
// Wallet integration wrapper using Mesh.js BrowserWallet API
'use client';

import { Network } from '@/domain/tx';

// Dynamic import to avoid server-side WASM loading issues
let BrowserWallet: any = null;

async function getBrowserWallet() {
  if (typeof window === 'undefined') {
    throw new Error('BrowserWallet can only be used in the browser');
  }
  
  if (!BrowserWallet) {
    const meshModule = await import('@meshsdk/core');
    BrowserWallet = meshModule.BrowserWallet;
  }
  
  return BrowserWallet;
}

export type WalletExtension = {
  cip: number;
};

export type WalletInfo = {
  name: string;
  version: string;
  icon: string;
  supportedExtensions?: WalletExtension[];
};

export type DRepInfo = {
  publicKey: string;
  publicKeyHash: string;
  dRepIDCip105: string;
  dRepIDCip129?: string;
};

export type StakeKeyInfo = {
  pubStakeKey: string;
  pubStakeKeyHash?: string;
};

export type StakeKeysInfo = {
  registered: StakeKeyInfo[];
  unregistered: StakeKeyInfo[];
};

/**
 * Get list of available wallets on the user's device with their supported extensions
 * Uses Mesh.js getSupportedExtensions to show which CIPs each wallet supports
 */
export async function getAvailableWallets(): Promise<WalletInfo[]> {
  try {
    const BW = await getBrowserWallet();
    const wallets = await BW.getAvailableWallets();
    
    // Fetch supported extensions for each wallet
    const walletsWithExtensions = await Promise.all(
      wallets.map(async (w: any) => {
        let supportedExtensions: WalletExtension[] = [];
        
        try {
          // Use getSupportedExtensions static method to get extensions without connecting
          if (typeof BW.getSupportedExtensions === 'function') {
            const extensions = await BW.getSupportedExtensions(w.name);
            if (Array.isArray(extensions)) {
              supportedExtensions = extensions.map((ext: any) => ({
                cip: typeof ext.cip === 'number' ? ext.cip : parseInt(String(ext.cip), 10),
              }));
            }
          }
        } catch (extError) {
          console.warn(`Could not fetch extensions for ${w.name}:`, extError);
          // Continue without extensions if fetch fails
        }
        
        return {
          name: w.name,
          version: w.version || 'unknown',
          icon: w.icon || '',
          supportedExtensions,
        };
      })
    );
    
    return walletsWithExtensions;
  } catch (error) {
    console.error('Error getting available wallets:', error);
    return [];
  }
}

/**
 * Check if a wallet supports specific CIP extensions (before connecting)
 * Uses Mesh.js getSupportedExtensions static method
 */
export async function checkWalletSupportsCIP(walletName: string, cip: number): Promise<boolean> {
  try {
    const BW = await getBrowserWallet();
    if (typeof BW.getSupportedExtensions === 'function') {
      const supported = await BW.getSupportedExtensions(walletName);
      return Array.isArray(supported) && supported.some((ext: any) => ext.cip === cip);
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Connect to a wallet with specified CIP extensions
 * @param walletName - Name of the wallet to connect
 * @param cips - Array of CIP numbers to enable (e.g., [30, 95])
 */
export async function connectWallet(walletName: string, cips: number[] = [30, 95]): Promise<any> {
  try {
    const BW = await getBrowserWallet();
    // Ensure CIP-30 is always included (it's the base standard)
    const cipsToEnable = cips.includes(30) ? cips : [30, ...cips];
    
    const wallet = await BW.enable(walletName, cipsToEnable);
    return wallet;
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
}

/**
 * Get wallet information (name, network, balance)
 */
export async function getWalletInfo(wallet: any): Promise<{
  name: string;
  networkId: number;
  balance: string;
  network: Network;
}> {
  try {
    const networkId = await wallet.getNetworkId();
    const balance = await wallet.getLovelace();
    
    // Map network ID to Network type
    const network: Network = networkId === 1 ? 'mainnet' : networkId === 0 ? 'preprod' : 'preview';
    
    return {
      name: wallet.name || 'Unknown',
      networkId,
      balance,
      network,
    };
  } catch (error) {
    console.error('Error getting wallet info:', error);
    throw error;
  }
}

/**
 * Check if connected wallet supports CIP-95 extension
 * Uses Mesh.js getExtensions() API as documented: https://meshjs.dev/apis/wallets/browserwallet#get-extensions
 */
async function checkCIP95Support(wallet: any): Promise<boolean> {
  try {
    // Method 1: Use Mesh.js getExtensions() API (recommended)
    if (typeof wallet.getExtensions === 'function') {
      try {
        const extensions = await wallet.getExtensions();
        
        if (Array.isArray(extensions)) {
          const hasCIP95 = extensions.some((ext: any) => {
            // Handle both { cip: 95 } and { cip: "95" } formats
            const cipValue = ext.cip;
            return cipValue === 95 || cipValue === '95' || String(cipValue) === '95';
          });
          
          if (hasCIP95) {
            return true;
          }
        }
      } catch (extError) {
        // Silently fail and try fallback
      }
    }
    
    // Method 2: Fallback - check if CIP-95 methods exist
    // This is a fallback for wallets that might support CIP-95 but don't report it via getExtensions()
    if (typeof wallet.getDRep === 'function') {
      return true;
    }
    
    return false;
  } catch (error) {
    // Final fallback: check method existence
    return typeof wallet.getDRep === 'function';
  }
}

/**
 * Get DRep information from wallet (CIP-95)
 */
export async function getDRepInfo(wallet: any): Promise<DRepInfo | null> {
  try {
    // Check if wallet supports CIP-95
    const supportsCIP95 = await checkCIP95Support(wallet);
    
    if (!supportsCIP95) {
      return null;
    }
    
    // Try to get DRep info - if method doesn't exist, it will throw
    const drepInfo = await wallet.getDRep();
    
    if (!drepInfo) {
      return null;
    }
    
    // Normalize the response format
    return {
      publicKey: drepInfo.publicKey || drepInfo.pubDrepKey || '',
      publicKeyHash: drepInfo.publicKeyHash || drepInfo.pubDrepKeyHash || '',
      dRepIDCip105: drepInfo.dRepIDCip105 || drepInfo.drepIDCip105 || '',
      dRepIDCip129: drepInfo.dRepIDCip129 || drepInfo.drepIDCip129,
    };
  } catch (error) {
    // If getDRep doesn't exist or fails, return null
    return null;
  }
}

/**
 * Get registered and unregistered stake keys from wallet (CIP-95)
 */
export async function getStakeKeys(wallet: any): Promise<StakeKeysInfo> {
  try {
    // Check if wallet supports CIP-95
    const supportsCIP95 = await checkCIP95Support(wallet);
    
    if (!supportsCIP95) {
      return { registered: [], unregistered: [] };
    }
    
    // Try to get stake keys - if methods don't exist, they will throw
    const registered = await wallet.getRegisteredPubStakeKeys();
    const unregistered = await wallet.getUnregisteredPubStakeKeys();
    
    // Handle different response formats
    const normalizeStakeKeys = (keys: any): StakeKeyInfo[] => {
      if (!keys) return [];
      
      // If it's an array of strings (hashes), convert to objects
      if (Array.isArray(keys) && typeof keys[0] === 'string') {
        return keys.map((hash: string) => ({ pubStakeKey: hash, pubStakeKeyHash: hash }));
      }
      
      // If it's an object with pubStakeKeyHashes array
      if (keys.pubStakeKeyHashes && Array.isArray(keys.pubStakeKeyHashes)) {
        return keys.pubStakeKeyHashes.map((hash: string) => ({ pubStakeKey: hash, pubStakeKeyHash: hash }));
      }
      
      // If it's an object with pubStakeKeys array
      if (keys.pubStakeKeys && Array.isArray(keys.pubStakeKeys)) {
        return keys.pubStakeKeys.map((key: any) => ({
          pubStakeKey: typeof key === 'string' ? key : (key.pubStakeKey || key.pubStakeKeyHash || ''),
          pubStakeKeyHash: typeof key === 'string' ? key : (key.pubStakeKeyHash || key.pubStakeKey || ''),
        }));
      }
      
      // If it's an array of objects with pubStakeKey
      if (Array.isArray(keys)) {
        return keys.map((key: any) => ({
          pubStakeKey: key.pubStakeKey || key.pubStakeKeyHash || (typeof key === 'string' ? key : ''),
          pubStakeKeyHash: key.pubStakeKeyHash || key.pubStakeKey || (typeof key === 'string' ? key : ''),
        }));
      }
      
      return [];
    };
    
    return {
      registered: normalizeStakeKeys(registered),
      unregistered: normalizeStakeKeys(unregistered),
    };
  } catch (error) {
    console.error('Error getting stake keys:', error);
    return { registered: [], unregistered: [] };
  }
}

/**
 * Sign a transaction using the wallet
 */
export async function signTransaction(wallet: any, txHex: string): Promise<string> {
  try {
    const signedTx = await wallet.signTx(txHex, false);
    return signedTx;
  } catch (error) {
    console.error('Error signing transaction:', error);
    throw error;
  }
}

/**
 * Submit a signed transaction to the network
 */
export async function submitTransaction(wallet: any, signedTxHex: string): Promise<string> {
  try {
    const txHash = await wallet.submitTx(signedTxHex);
    return txHash;
  } catch (error) {
    console.error('Error submitting transaction:', error);
    throw error;
  }
}

/**
 * Get UTXOs from the wallet for transaction building
 */
export async function getUTXOs(wallet: any): Promise<any[]> {
  try {
    const utxos = await wallet.getUtxos();
    return utxos || [];
  } catch (error) {
    console.error('Error getting UTXOs:', error);
    throw error;
  }
}

/**
 * Get change address from wallet
 */
export async function getChangeAddress(wallet: any): Promise<string> {
  try {
    const address = await wallet.getChangeAddress();
    return address;
  } catch (error) {
    console.error('Error getting change address:', error);
    throw error;
  }
}
