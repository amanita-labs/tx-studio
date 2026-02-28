// src/components/asset-display.tsx
'use client';

import { useState } from 'react';
import { TokenMetadata } from '@/lib/token-registry';
import { formatAssetQuantity } from '@/lib/utils/ada';
import { computeAssetFingerprint, decodeAssetName } from '@/lib/utils/asset-fingerprint';
import { Copy, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BlockExplorerLink } from '@/components/block-explorer-link';

interface AssetDisplayProps {
  asset: { policyId: string; assetName: string; quantity: bigint };
  metadata?: TokenMetadata | null; // undefined = loading, null = not found
}

export function AssetDisplay({ asset, metadata }: AssetDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const assetId = `${asset.policyId}${asset.assetName}`;
  const fingerprint = computeAssetFingerprint(asset.policyId, asset.assetName);
  const formattedQuantity = formatAssetQuantity(asset.quantity, metadata?.decimals ?? 0);
  const decodedAssetName = decodeAssetName(asset.assetName);

  // Loading state
  if (metadata === undefined) {
    return (
      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
          <span className="text-muted-foreground truncate text-[11px]">
            {decodedAssetName || asset.assetName}
          </span>
        </div>
        <span className="font-mono flex-shrink-0">{formatAssetQuantity(asset.quantity)}</span>
      </div>
    );
  }

  // Not found — fallback display
  if (metadata === null) {
    return (
      <div className="flex items-center justify-between text-xs gap-2">
        <span className="truncate">
          {decodedAssetName || asset.assetName}
        </span>
        <span className="font-mono flex-shrink-0">{formatAssetQuantity(asset.quantity)}</span>
      </div>
    );
  }

  // Has metadata
  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors text-left"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          )}
          {metadata.logo && (
            <img
              src={`data:image/png;base64,${metadata.logo}`}
              alt={metadata.name}
              className="h-4 w-4 flex-shrink-0 rounded-sm"
            />
          )}
          <span className="font-medium truncate">
            {metadata.ticker ?? metadata.name}
          </span>
          <span className="text-muted-foreground text-[11px] truncate">
            {asset.policyId.slice(0, 8)}...
          </span>
        </div>
        <span className="font-mono flex-shrink-0">{formattedQuantity}</span>
      </button>

      {expanded && (
        <div className="ml-5 mt-1 space-y-1.5 border-l pl-3 pb-1">
          {metadata.ticker && metadata.name !== metadata.ticker && (
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">{metadata.name}</span>
            </div>
          )}

          {metadata.description && (
            <p className="text-muted-foreground text-[11px] leading-snug">
              {metadata.description}
            </p>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Fingerprint:</span>
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] truncate">
                {fingerprint}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(fingerprint, 'Fingerprint');
                }}
              >
                <Copy className="h-2.5 w-2.5" />
              </Button>
              <span onClick={(e) => e.stopPropagation()}>
                <BlockExplorerLink
                  type="asset"
                  params={{ assetId, policyId: asset.policyId, assetName: asset.assetName }}
                />
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Policy:</span>
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] truncate">
                {asset.policyId}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(asset.policyId, 'Policy ID');
                }}
              >
                <Copy className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            {metadata.url && (
              <a
                href={metadata.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Website
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
