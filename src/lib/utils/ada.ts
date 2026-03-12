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
  const fixed = ada.toFixed(decimals);
  const [whole, frac] = fixed.split('.');
  const wholeWithCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac !== undefined ? `${wholeWithCommas}.${frac}` : wholeWithCommas;
}

export function formatLovelace(lovelace: bigint): string {
  return lovelace.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatAssetQuantity(quantity: bigint, decimals: number = 0): string {
  if (decimals <= 0) {
    return quantity.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const isNegative = quantity < BigInt(0);
  const abs = isNegative ? -quantity : quantity;
  const str = abs.toString().padStart(decimals + 1, '0');
  const intPart = str.slice(0, str.length - decimals);
  const fracPart = str.slice(str.length - decimals);
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}${formattedInt}.${fracPart}`;
}
