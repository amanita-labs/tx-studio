'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { commitUrl, registryUrl, verifyUrl } from '@/lib/uplc-link/client';
import { useUplcVerification } from '@/hooks/use-uplc-verification';
import { toast } from 'sonner';

interface UplcLinkBadgeProps {
  hash: string;
  /** Inspector script type, e.g. "plutus-v2" or "native". Native scripts render nothing. */
  type: string;
  /** Containing tx hash, used to prefill the "Submit verification" CTA. */
  txHash?: string;
  className?: string;
}

const VERIFIED_BADGE =
  'border-emerald-400/60 text-emerald-700 dark:text-emerald-400 dark:border-emerald-500/40 cursor-pointer';
const NOT_VERIFIED_BADGE =
  'text-muted-foreground border-muted-foreground/30 cursor-pointer';
const ERROR_BADGE =
  'border-amber-400/60 text-amber-700 dark:text-amber-400 dark:border-amber-500/40 cursor-pointer';

export function UplcLinkBadge({ hash, type, txHash, className }: UplcLinkBadgeProps) {
  const isPlutus = type.toLowerCase().startsWith('plutus');
  const { result, refetch } = useUplcVerification(isPlutus ? hash : undefined);

  if (!isPlutus) return null;

  if (result.state === 'loading') {
    return (
      <Badge variant="outline" className={cn('gap-1', className)} title="Checking uplc.link">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>checking source</span>
      </Badge>
    );
  }

  if (result.state === 'error') {
    return (
      <Badge
        variant="outline"
        className={cn('gap-1', ERROR_BADGE, className)}
        onClick={refetch}
        title={`uplc.link lookup failed: ${result.message}. Click to retry.`}
        role="button"
      >
        <AlertTriangle className="h-3 w-3" />
        <span>uplc.link unavailable</span>
      </Badge>
    );
  }

  if (result.state === 'verified') {
    return (
      <VerifiedBadge
        hash={hash}
        result={result}
        className={className}
      />
    );
  }

  // not-verified
  return (
    <NotVerifiedBadge hash={hash} txHash={txHash} className={className} />
  );
}

function VerifiedBadge({
  hash,
  result,
  className,
}: {
  hash: string;
  result: Extract<ReturnType<typeof useUplcVerification>['result'], { state: 'verified' }>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, matchedScript, matchKind } = result;
  const commit = commitUrl(data.sourceUrl, data.commitHash);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={cn('gap-1', VERIFIED_BADGE, className)}
          title="Source-verified on uplc.link"
          role="button"
        >
          <ShieldCheck className="h-3 w-3" />
          <span>verified source</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified on uplc.link
          </div>
          <div className="text-xs text-muted-foreground">
            On-chain script hash matches a public source build.
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <Row label="Validator" value={matchedScript.validatorName || '—'} />
          {matchedScript.scriptName && matchedScript.scriptName !== matchedScript.validatorName && (
            <Row label="Script" value={matchedScript.scriptName} />
          )}
          <Row label="Plutus" value={matchedScript.plutusVersion} />
          <Row
            label="Compiler"
            value={`${data.compilerType} ${data.compilerVersion}`}
          />
          <Row
            label="Parameters"
            value={
              matchedScript.parameterizationStatus === 'COMPLETE'
                ? 'Fully applied'
                : matchedScript.parameterizationStatus === 'PARTIAL'
                  ? 'Partial'
                  : matchedScript.parameterizationStatus
            }
          />
          <Row
            label="Match"
            value={matchKind === 'finalHash' ? 'Final hash' : 'Raw hash'}
          />
        </div>

        <div className="space-y-1.5 border-t pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Source</span>
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium underline truncate max-w-[180px]"
              title={data.sourceUrl}
            >
              {data.sourceUrl.replace(/^https?:\/\//, '')}
            </a>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Commit</span>
            <div className="flex items-center gap-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {data.commitHash.slice(0, 8)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => copy(data.commitHash, 'Commit hash')}
              >
                <Copy className="h-3 w-3" />
              </Button>
              {commit && (
                <Button asChild variant="ghost" size="sm" className="h-5 w-5 p-0">
                  <a
                    href={commit}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View commit on Git host"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <Button asChild size="sm" className="w-full">
          <a href={registryUrl(hash)} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            View on uplc.link
          </a>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function NotVerifiedBadge({
  hash,
  txHash,
  className,
}: {
  hash: string;
  txHash?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={cn('gap-1', NOT_VERIFIED_BADGE, className)}
          title="Source not in uplc.link registry"
          role="button"
        >
          <ShieldOff className="h-3 w-3" />
          <span>not verified</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold">Source not in registry</div>
          <div className="text-xs text-muted-foreground">
            This script&apos;s hash isn&apos;t in the{' '}
            <a
              href="https://uplc.link"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              uplc.link
            </a>{' '}
            registry. There&apos;s no public source build to compare against.
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button asChild size="sm" variant="outline">
            <a href={registryUrl(hash)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Search registry
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={verifyUrl(txHash)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Submit verification
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate max-w-[200px]" title={value}>
        {value}
      </span>
    </div>
  );
}
