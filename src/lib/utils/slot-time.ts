// src/lib/utils/slot-time.ts

/**
 * Converts a Cardano slot number to a local timezone date string
 * @param slot - The slot number
 * @param network - The network type ('mainnet' or 'preview')
 * @returns Formatted date string in local timezone
 */
export function slotToLocalTime(slot: number, network: 'mainnet' | 'preview' = 'mainnet'): string {
  // Slot to UNIX timestamp conversion
  const slotToUnixTimestamp = (slotNumber: number, networkType: 'mainnet' | 'preview'): number => {
    const epochStart = networkType === 'mainnet' ? 1591566291 : 1666656000;
    return slotNumber + epochStart;
  };

  const unixTimestamp = slotToUnixTimestamp(slot, network);
  const date = new Date(unixTimestamp * 1000); // Convert to milliseconds
  
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Converts a Cardano slot number to a Date object
 * @param slot - The slot number
 * @param network - The network type ('mainnet' or 'preview')
 * @returns Date object
 */
export function slotToDate(slot: number, network: 'mainnet' | 'preview' = 'mainnet'): Date {
  const epochStart = network === 'mainnet' ? 1591566291 : 1666656000;
  const unixTimestamp = slot + epochStart;
  return new Date(unixTimestamp * 1000);
}

/**
 * Formats a slot number with its equivalent local time
 * @param slot - The slot number
 * @param network - The network type ('mainnet' or 'preview')
 * @returns Formatted string with slot and local time
 */
export function formatSlotWithTime(slot: number, network: 'mainnet' | 'preview' = 'mainnet'): string {
  const localTime = slotToLocalTime(slot, network);
  return `${slot.toLocaleString()} (${localTime})`;
}
