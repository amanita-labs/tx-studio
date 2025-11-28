// src/lib/wallet-connector.ts
// Wallet integration wrapper using Mesh.js BrowserWallet API

import { BrowserWallet } from '@meshsdk/core';
import { Network } from '@/domain/tx';

export type WalletInfo = {
  name: string;
  version: string;
  icon: string;
};

export type DRepInfo = {
  publicKey: string;
  publicKeyHash: string;
  dRepIDCip105: string;
  dRepIDCip129?: string;
};

export type StakeKeysInfo = {
  registered: string[];
  unregistered: string[];
};

/**
 * Get list of available wallets on the user's device
 */
export async function getAvailableWallets(): Promise<WalletInfo[]> {
  try {
    const wallets = await BrowserWallet.getAvailableWallets();
    return wallets.map(w => ({
      name: w.name,
      version: w.version || 'unknown',
      icon: w.icon || '',
    }));
  } catch (error) {
    console.error('Error getting available wallets:', error);
    return [];
  }
}

/**
 * Connect to a wallet with CIP-95 support
 */
export async function connectWallet(walletName: string): Promise<any> {
  try {
    const wallet = await BrowserWallet.enable(walletName, [95]);
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
 * Get DRep information from wallet (CIP-95)
 */
export async function getDRepInfo(wallet: any): Promise<DRepInfo | null> {
  try {
    // Check if wallet supports CIP-95
    const extensions = await wallet.getExtensions();
    const supportsCIP95 = extensions?.some((ext: any) => ext.cip === 95);
    
    if (!supportsCIP95) {
      return null;
    }
    
    const drepInfo = await wallet.getDRep();
    return drepInfo || null;
  } catch (error) {
    console.error('Error getting DRep info:', error);
    return null;
  }
}

/**
 * Get registered and unregistered stake keys from wallet (CIP-95)
 */
export async function getStakeKeys(wallet: any): Promise<StakeKeysInfo> {
  try {
    // Check if wallet supports CIP-95
    const extensions = await wallet.getExtensions();
    const supportsCIP95 = extensions?.some((ext: any) => ext.cip === 95);
    
    if (!supportsCIP95) {
      return { registered: [], unregistered: [] };
    }
    
    const registered = await wallet.getRegisteredPubStakeKeys();
    const unregistered = await wallet.getUnregisteredPubStakeKeys();
    
    return {
      registered: registered?.pubStakeKeyHashes || [],
      unregistered: unregistered?.pubStakeKeyHashes || [],
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
