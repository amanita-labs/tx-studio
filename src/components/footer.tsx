// src/components/footer.tsx
'use client';

import Link from 'next/link';
import { Github } from 'lucide-react';

export function Footer() {
  const version = '0.1.0';

  return (
    <footer className="border-t bg-background mt-auto flex-shrink-0">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>Transaction Studio v{version}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="https://github.com/amanita-labs/tx-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="h-3 w-3" />
              <span>GitHub</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
