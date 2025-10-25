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

/**
 * Calculates time remaining until a slot expires
 * @param slot - The slot number
 * @param network - The network type ('mainnet' or 'preview')
 * @returns Object with time remaining info
 */
export function getTimeRemaining(slot: number, network: 'mainnet' | 'preview' = 'mainnet'): {
  isExpired: boolean;
  timeRemaining: string;
  days: number;
  hours: number;
  minutes: number;
} {
  const slotDate = slotToDate(slot, network);
  const now = new Date();
  const diffMs = slotDate.getTime() - now.getTime();
  
  const isExpired = diffMs <= 0;
  
  if (isExpired) {
    return {
      isExpired: true,
      timeRemaining: 'Expired',
      days: 0,
      hours: 0,
      minutes: 0
    };
  }
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  let timeRemaining = '';
  if (days > 0) {
    timeRemaining = `${days} day${days !== 1 ? 's' : ''}`;
    if (hours > 0) {
      timeRemaining += `, ${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  } else if (hours > 0) {
    timeRemaining = `${hours} hour${hours !== 1 ? 's' : ''}`;
    if (minutes > 0) {
      timeRemaining += `, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  } else {
    timeRemaining = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  return {
    isExpired: false,
    timeRemaining,
    days,
    hours,
    minutes
  };
}

/**
 * Formats validity window with time remaining
 * @param startSlot - The start slot number
 * @param endSlot - The end slot number
 * @param network - The network type ('mainnet' or 'preview')
 * @returns Formatted validity window info
 */
export function formatValidityWindow(
  startSlot: number, 
  endSlot: number, 
  network: 'mainnet' | 'preview' = 'mainnet'
): {
  start: {
    slot: number;
    time: string;
    timeRemaining: string;
    isExpired: boolean;
  };
  end: {
    slot: number;
    time: string;
    timeRemaining: string;
    isExpired: boolean;
  };
  status: 'not-started' | 'active' | 'expired';
} {
  const now = new Date();
  const startDate = slotToDate(startSlot, network);
  const endDate = slotToDate(endSlot, network);
  
  const startTimeRemaining = getTimeRemaining(startSlot, network);
  const endTimeRemaining = getTimeRemaining(endSlot, network);
  
  let status: 'not-started' | 'active' | 'expired';
  if (now < startDate) {
    status = 'not-started';
  } else if (now > endDate) {
    status = 'expired';
  } else {
    status = 'active';
  }
  
  return {
    start: {
      slot: startSlot,
      time: slotToLocalTime(startSlot, network),
      timeRemaining: startTimeRemaining.isExpired ? 'Expired' : startTimeRemaining.timeRemaining,
      isExpired: startTimeRemaining.isExpired
    },
    end: {
      slot: endSlot,
      time: slotToLocalTime(endSlot, network),
      timeRemaining: endTimeRemaining.isExpired ? 'Expired' : endTimeRemaining.timeRemaining,
      isExpired: endTimeRemaining.isExpired
    },
    status
  };
}
