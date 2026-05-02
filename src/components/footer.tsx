import Link from 'next/link';
import { Github } from 'lucide-react';

const REPO_URL = 'https://github.com/amanita-labs/tx-studio';
const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
const commit = process.env.NEXT_PUBLIC_GIT_COMMIT ?? 'dev';

export function Footer() {
  const versionHref = `${REPO_URL}/releases/tag/v${version}`;
  const commitHref = commit === 'dev' ? REPO_URL : `${REPO_URL}/commit/${commit}`;

  return (
    <footer>
      <div className="container mx-auto px-4">
        <div className="flex h-7 items-center justify-center gap-2 text-xs text-muted-foreground">
          <Link
            href={versionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            v{version}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href={commitHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-foreground hover:underline"
          >
            {commit}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground hover:underline"
          >
            <Github className="h-3.5 w-3.5" />
            <span>GitHub</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
