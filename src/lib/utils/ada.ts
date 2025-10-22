// src/lib/utils/ada.ts
const LOVELACE_PER_ADA = BigInt(1_000_000);

export function lovelaceToAda(lovelace: bigint): number {
  return Number(lovelace) / Number(LOVELACE_PER_ADA);
}

export function adaToLovelace(ada: number): bigint {
  return BigInt(Math.floor(ada * Number(LOVELACE_PER_ADA)));
}

export function formatAda(lovelace: bigint, decimals: number = 6): string {
  const ada = lovelaceToAda(lovelace);
  return ada.toFixed(decimals);
}

export function formatLovelace(lovelace: bigint): string {
  return lovelace.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatAssetQuantity(quantity: bigint, decimals: number = 0): string {
  return quantity.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
