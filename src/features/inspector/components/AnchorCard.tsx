'use client';

import type React from 'react';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useGovernanceMetadata } from '@/hooks/use-governance-metadata';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SafeMarkdown } from './SafeMarkdown';
import type { CollectedAnchor } from '@/lib/governance-metadata/collect-anchors';
import type {
  AuthorWitness,
  DetectedCip,
  ResolvedGovernanceMetadata,
} from '@/lib/governance-metadata/types';

const cipLabel: Record<DetectedCip, string> = {
  'cip-100': 'CIP-100',
  'cip-108': 'CIP-108',
  'cip-119': 'CIP-119',
  'cip-136': 'CIP-136',
  unknown: 'Unrecognized',
};

function readString(doc: Record<string, unknown>, ...path: string[]): string | undefined {
  let cur: unknown = doc;
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === 'string' && cur.length > 0 ? cur : undefined;
}

function readArray<T = unknown>(doc: Record<string, unknown>, key: string): T[] {
  const v = doc[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function readBody(doc: Record<string, unknown>): Record<string, unknown> {
  const body = doc.body;
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : doc;
}

function ReferencesList({
  refs,
}: {
  refs: Array<{ '@type'?: string; label?: string; uri?: string }>;
}) {
  if (refs.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-1">References</h4>
      <ul className="space-y-1 text-sm">
        {refs.map((r, i) => (
          <li key={i} className="flex items-baseline gap-2">
            {r['@type'] && (
              <Badge variant="outline" className="text-xs">
                {r['@type']}
              </Badge>
            )}
            {r.uri ? (
              <a
                href={r.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 break-all"
              >
                {r.label ?? r.uri}
              </a>
            ) : (
              <span>{r.label ?? '(no label)'}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CipBody({ result }: { result: ResolvedGovernanceMetadata }) {
  const body = readBody(result.document);

  switch (result.detectedCip) {
    case 'cip-119': {
      const name = readString(body, 'givenName');
      const objectives = readString(body, 'objectives');
      const motivations = readString(body, 'motivations');
      const qualifications = readString(body, 'qualifications');
      const paymentAddress = readString(body, 'paymentAddress');
      const refs = readArray<{ '@type'?: string; label?: string; uri?: string }>(body, 'references');
      return (
        <div className="space-y-3">
          {name && <h3 className="text-base font-semibold">{name}</h3>}
          {objectives && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Objectives</h4>
              <SafeMarkdown source={objectives} />
            </div>
          )}
          {motivations && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Motivations</h4>
              <SafeMarkdown source={motivations} />
            </div>
          )}
          {qualifications && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Qualifications</h4>
              <SafeMarkdown source={qualifications} />
            </div>
          )}
          {paymentAddress && (
            <div className="text-sm">
              <span className="text-muted-foreground">Payment address: </span>
              <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
                {paymentAddress}
              </code>
            </div>
          )}
          <ReferencesList refs={refs} />
        </div>
      );
    }
    case 'cip-108': {
      const title = readString(body, 'title');
      const abstract = readString(body, 'abstract');
      const motivation = readString(body, 'motivation');
      const rationale = readString(body, 'rationale');
      const refs = readArray<{ '@type'?: string; label?: string; uri?: string }>(body, 'references');
      return (
        <div className="space-y-3">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {abstract && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Abstract</h4>
              <SafeMarkdown source={abstract} />
            </div>
          )}
          {motivation && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Motivation</h4>
              <SafeMarkdown source={motivation} />
            </div>
          )}
          {rationale && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Rationale</h4>
              <SafeMarkdown source={rationale} />
            </div>
          )}
          <ReferencesList refs={refs} />
        </div>
      );
    }
    case 'cip-136': {
      const summary = readString(body, 'summary');
      const rationale = readString(body, 'rationaleStatement');
      const precedent = readString(body, 'precedentDiscussion');
      const counter = readString(body, 'counterargumentDiscussion');
      const conclusion = readString(body, 'conclusion');
      const refs = readArray<{ '@type'?: string; label?: string; uri?: string }>(body, 'references');
      return (
        <div className="space-y-3">
          {summary && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Summary</h4>
              <SafeMarkdown source={summary} />
            </div>
          )}
          {rationale && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Rationale</h4>
              <SafeMarkdown source={rationale} />
            </div>
          )}
          {precedent && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">
                Precedent discussion
              </h4>
              <SafeMarkdown source={precedent} />
            </div>
          )}
          {counter && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">
                Counterargument discussion
              </h4>
              <SafeMarkdown source={counter} />
            </div>
          )}
          {conclusion && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Conclusion</h4>
              <SafeMarkdown source={conclusion} />
            </div>
          )}
          <ReferencesList refs={refs} />
        </div>
      );
    }
    default:
      return (
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Schema not recognized — showing raw document.
          </p>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
            {JSON.stringify(result.document, null, 2)}
          </pre>
        </div>
      );
  }
}

const onChainKindLabel: Record<string, string> = {
  proposalProcedure: 'a governance action (proposal procedure)',
  votingProcedures: 'voting procedures',
  certificate: 'a DRep / committee certificate',
  unknown: 'an on-chain item',
};

function Cip169Section({ result }: { result: ResolvedGovernanceMetadata }) {
  if (!result.hasCip169Extension) return null;
  const b = result.cip169;
  let body: React.ReactNode;
  if (!b || b.status === 'idle' || b.status === 'verifying') {
    body = <span className="text-muted-foreground">Verifying transaction binding…</span>;
  } else if (b.status === 'ok') {
    body = (
      <span className="text-green-600 dark:text-green-400">
        ✓ Binds to this transaction (selector: {b.selectorKind})
      </span>
    );
  } else if (b.status === 'not-in-tx') {
    body = (
      <div className="text-muted-foreground space-y-1">
        <p>
          This document declares a CIP-169 binding to{' '}
          {onChainKindLabel[b.boundKind] ?? 'an on-chain item'}, which is not part of this
          transaction — the binding most likely refers to a different transaction.
        </p>
        <p className="text-xs">Open that transaction to verify this binding.</p>
      </div>
    );
  } else if (b.status === 'undecodable') {
    body = (
      <div className="text-yellow-700 dark:text-yellow-400 space-y-1">
        <p>
          ⚠ This transaction contains {onChainKindLabel[b.boundKind] ?? 'the on-chain item'} that
          this binding refers to, but the metadata library could not decode it, so the binding
          cannot be verified.
        </p>
        <p className="text-xs text-muted-foreground font-mono break-all">{b.reason}</p>
      </div>
    );
  } else if (b.status === 'mismatch') {
    body = (
      <div>
        <span className="text-yellow-600 dark:text-yellow-400">
          ⚠ Does not match this transaction
        </span>
        {b.differences.length > 0 && (
          <ul className="list-disc pl-5 mt-1 text-xs text-muted-foreground">
            {b.differences.slice(0, 8).map((d, i) => (
              <li key={i}>
                <code className="text-xs">{d.path}</code>
              </li>
            ))}
            {b.differences.length > 8 && <li>… and {b.differences.length - 8} more</li>}
          </ul>
        )}
      </div>
    );
  } else {
    body = <span className="text-red-600 dark:text-red-400">Verify failed: {b.error}</span>;
  }
  return (
    <div className="mb-3">
      <h4 className="text-sm font-medium mb-1">Transaction binding (CIP-169)</h4>
      <div className="text-sm">{body}</div>
    </div>
  );
}

function AuthorsList({ authors }: { authors: AuthorWitness[] }) {
  if (authors.length === 0) return null;
  const validCount = authors.filter((a) => a.signature === 'valid').length;
  return (
    <div className="mb-3">
      <h4 className="text-sm font-medium mb-2">
        Authors — {validCount} of {authors.length} signature{authors.length === 1 ? '' : 's'} valid
      </h4>
      <ul className="space-y-1">
        {authors.map((a, i) => (
          <li key={`${a.pubkeyHex}-${i}`} className="text-sm flex items-center gap-2 flex-wrap">
            {a.pubkeyHex && (
              <span className="font-mono text-xs text-muted-foreground">
                {a.pubkeyHex.slice(0, 16)}…
              </span>
            )}
            {a.signature === 'valid' && (
              <Badge variant="secondary" className="text-green-700 dark:text-green-400">
                ✓ valid
              </Badge>
            )}
            {a.signature === 'invalid' && <Badge variant="destructive">✗ invalid</Badge>}
            {a.signature === 'unverifiable' && <Badge variant="outline">not verifiable</Badge>}
            {a.label && (
              <Badge variant="outline" title={a.label.description}>
                {a.label.name}
              </Badge>
            )}
            {a.name && <span className="text-muted-foreground">— {a.name}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnchorCard({
  anchor,
  txHex,
  defaultMetadataOpen = true,
}: {
  anchor: CollectedAnchor;
  txHex: string;
  /**
   * Whether the metadata document section starts expanded. The validation
   * results (hash match, schema issues, CIP-169 binding, authors) are always
   * visible; only the document body is collapsible. Callers collapse it by
   * default when a tx has many anchors so the tab reads as a list of
   * validations.
   */
  defaultMetadataOpen?: boolean;
}) {
  const state = useAppStore((s) => s.governanceMetadata[anchor.key]) ?? { status: 'idle' as const };
  const { resolveOne } = useGovernanceMetadata();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium break-all">{anchor.url}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
              hash: {anchor.hash}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {state.status === 'idle' && (
              <>
                <Badge variant="outline">Not resolved</Badge>
                <Button size="sm" onClick={() => resolveOne(anchor, txHex)}>
                  Resolve
                </Button>
              </>
            )}
            {state.status === 'fetching' && <Badge variant="outline">Fetching…</Badge>}
            {state.status === 'error' && (
              <>
                <Badge variant="destructive">Failed</Badge>
                <Button size="sm" variant="outline" onClick={() => resolveOne(anchor, txHex)}>
                  Retry
                </Button>
              </>
            )}
            {state.status === 'resolved' && (
              <>
                <Badge
                  variant={state.result.hashOk ? 'secondary' : 'outline'}
                  className={
                    state.result.hashOk
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-yellow-700 dark:text-yellow-400'
                  }
                >
                  {state.result.hashOk ? '✓ Hash match' : '⚠ Hash mismatch'}
                </Badge>
                <Badge variant="outline">{cipLabel[state.result.detectedCip]}</Badge>
                {state.result.hasCip169Extension && (
                  <Badge variant="outline">+ CIP-169</Badge>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {state.status === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        {state.status === 'resolved' && (
          <>
            {!state.result.hashOk && (
              <Alert className="mb-3 border-yellow-500/50">
                <AlertTitle>Hash mismatch</AlertTitle>
                <AlertDescription>
                  This content does not match the hash anchored on-chain. The host may have
                  changed it after submission.
                </AlertDescription>
              </Alert>
            )}
            {state.result.schemaIssues.length > 0 && (
              <Alert className="mb-3 border-yellow-500/50">
                <AlertTitle>Schema issues ({state.result.schemaIssues.length})</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-xs mt-1 space-y-0.5">
                    {state.result.schemaIssues.slice(0, 5).map((iss, i) => (
                      <li key={i}>
                        {iss.path && <code className="text-xs">{iss.path}: </code>}
                        {iss.message}
                      </li>
                    ))}
                    {state.result.schemaIssues.length > 5 && (
                      <li className="text-muted-foreground">
                        … and {state.result.schemaIssues.length - 5} more
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {/* Verification checks first, before the metadata content */}
            <Cip169Section result={state.result} />
            <AuthorsList authors={state.result.authors} />
            {/* The document body is collapsible so a proposal-heavy tx can be
                read as a compact list of validations. */}
            <Collapsible
              defaultOpen={defaultMetadataOpen}
              className={
                state.result.hasCip169Extension || state.result.authors.length > 0
                  ? 'border-t pt-3 mt-1'
                  : undefined
              }
            >
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                Metadata document
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <CipBody result={state.result} />
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}
