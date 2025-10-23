// src/components/byte-gutter.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ByteGutterProps {
  hex: string;
  highlightedRanges?: Array<{ start: number; end: number; color: string; label: string }>;
  onByteHover?: (byteIndex: number) => void;
  onByteClick?: (byteIndex: number) => void;
  className?: string;
}

export function ByteGutter({ 
  hex, 
  highlightedRanges = [], 
  onByteHover, 
  onByteClick,
  className 
}: ByteGutterProps) {
  const [hoveredByte, setHoveredByte] = useState<number | null>(null);

  // Convert hex to bytes for display
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(hex.slice(i, i + 2));
  }

  // Group bytes into rows of 16
  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) {
    rows.push(bytes.slice(i, i + 16));
  }

  const getByteColor = (byteIndex: number) => {
    // Check if byte is in any highlighted range
    for (const range of highlightedRanges) {
      if (byteIndex >= range.start && byteIndex <= range.end) {
        return range.color;
      }
    }
    return 'bg-muted';
  };

  const getByteLabel = (byteIndex: number) => {
    for (const range of highlightedRanges) {
      if (byteIndex >= range.start && byteIndex <= range.end) {
        return range.label;
      }
    }
    return '';
  };

  return (
    <div className={cn("font-mono text-xs", className)}>
      {/* Header */}
      <div className="flex items-center mb-2 text-muted-foreground">
        <div className="w-16 text-right mr-2">Offset</div>
        <div className="flex-1 grid grid-cols-16 gap-1">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="text-center text-xs">
              {i.toString(16).toUpperCase().padStart(2, '0')}
            </div>
          ))}
        </div>
      </div>

      {/* Byte rows */}
      <div className="space-y-1">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center">
            {/* Offset */}
            <div className="w-16 text-right mr-2 text-muted-foreground">
              {(rowIndex * 16).toString(16).toUpperCase().padStart(4, '0')}
            </div>
            
            {/* Bytes */}
            <div className="flex-1 grid grid-cols-16 gap-1">
              {Array.from({ length: 16 }, (_, colIndex) => {
                const byteIndex = rowIndex * 16 + colIndex;
                const byte = row[colIndex];
                const isHovered = hoveredByte === byteIndex;
                const rangeColor = getByteColor(byteIndex);
                const rangeLabel = getByteLabel(byteIndex);

                return (
                  <div
                    key={colIndex}
                    className={cn(
                      "h-6 flex items-center justify-center rounded text-xs cursor-pointer transition-colors",
                      rangeColor,
                      isHovered && "ring-2 ring-primary",
                      !byte && "opacity-30"
                    )}
                    onMouseEnter={() => {
                      setHoveredByte(byteIndex);
                      onByteHover?.(byteIndex);
                    }}
                    onMouseLeave={() => setHoveredByte(null)}
                    onClick={() => onByteClick?.(byteIndex)}
                    title={rangeLabel || (byte ? `Byte ${byteIndex}: ${byte}` : '')}
                  >
                    {byte || '··'}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      {highlightedRanges.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Legend:</div>
          {highlightedRanges.map((range, index) => (
            <div key={index} className="flex items-center text-xs">
              <div 
                className={cn("w-3 h-3 rounded mr-2", range.color)}
              />
              <span>{range.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
