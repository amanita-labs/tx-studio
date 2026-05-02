'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Network } from '@/domain/tx';

const CQUISITOR_VALIDATOR_URL = 'https://cardananium.github.io/cquisitor/#transaction-validator';

interface CquisitorButtonProps {
  txHex: string;
  network: Network;
  networkDetected: boolean;
}

export function CquisitorButton({ txHex, network, networkDetected }: CquisitorButtonProps) {
  const handleClick = () => {
    const netParam = networkDetected ? network : 'unknown';
    const url = `${CQUISITOR_VALIDATOR_URL}?cbor=${txHex}&net=${netParam}&type=Transaction`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={handleClick}
          aria-label="Open in Cquisitor"
        >
          <Image
            src="/cquisitor-logo.png"
            alt=""
            width={18}
            height={18}
            className="rounded-sm"
            unoptimized
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Open in Cquisitor</TooltipContent>
    </Tooltip>
  );
}
