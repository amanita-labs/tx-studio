import { detectCipStandard } from '@amanita-labs/cardano-governance-metadata';
import * as cip100 from '@amanita-labs/cardano-governance-metadata/cip100';
import * as cip108 from '@amanita-labs/cardano-governance-metadata/cip108';
import * as cip119 from '@amanita-labs/cardano-governance-metadata/cip119';
import * as cip136 from '@amanita-labs/cardano-governance-metadata/cip136';
import {
  ValidationError,
  type GovernanceMetadataError,
} from '@amanita-labs/cardano-governance-metadata';
import type {
  CipStandard,
  VerifyInput,
  VerifyOptions,
  VerificationResult,
  Result,
} from '@amanita-labs/cardano-governance-metadata';
import { hexToBytes } from '@/lib/utils/hex';
import type { Network } from '@/domain/tx';
import type {
  AuthorWitness,
  DetectedCip,
  ResolvedGovernanceMetadata,
  SchemaIssue,
} from './types';
import { lookupAuthorLabel } from './author-labels';

export type ValidatorInput = {
  rawHex: string;
  document: Record<string, unknown>;
  computedHash: string;
  dataHash: string;
  hashOk: boolean;
  network: Network;
};

type VerifyFn = (
  input: VerifyInput,
  options?: VerifyOptions,
) => Promise<Result<VerificationResult, GovernanceMetadataError>>;

function pickVerify(detected: CipStandard | null): VerifyFn {
  switch (detected) {
    case 'CIP-119':
      return cip119.verify;
    case 'CIP-108':
      return cip108.verify;
    case 'CIP-136':
      return cip136.verify;
    case 'CIP-100':
    default:
      return cip100.verify;
  }
}

function detectedToType(c: CipStandard | null): DetectedCip {
  switch (c) {
    case 'CIP-100':
      return 'cip-100';
    case 'CIP-108':
      return 'cip-108';
    case 'CIP-119':
      return 'cip-119';
    case 'CIP-136':
      return 'cip-136';
    default:
      return 'unknown';
  }
}

function readBody(document: Record<string, unknown>): Record<string, unknown> | undefined {
  const body = document.body;
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined;
}

function detectCip169Extension(document: Record<string, unknown>): boolean {
  const body = readBody(document);
  return Boolean(body && 'onChain' in body);
}

function issuesFromError(err: GovernanceMetadataError | unknown): SchemaIssue[] {
  if (err instanceof ValidationError) {
    return err.issues.map((i) => ({ path: i.path, message: i.message, code: i.code }));
  }
  if (err instanceof Error) {
    return [{ path: '', message: err.message, code: 'UNKNOWN' }];
  }
  return [{ path: '', message: 'Unknown verification failure', code: 'UNKNOWN' }];
}

function authorsFromVerification(
  verification: VerificationResult | undefined,
  document: Record<string, unknown>,
  network: Network,
): AuthorWitness[] {
  // The library's witnesses array is keyed by author index. If the document has
  // an authors array, use it for names; otherwise fall back to whatever the
  // library reports.
  const documentAuthors = Array.isArray(document.authors)
    ? (document.authors as Array<{ name?: string }>)
    : [];

  const witnesses = verification?.witnesses ?? [];
  if (witnesses.length === 0 && documentAuthors.length > 0) {
    // No verification ran but authors are listed. Show them as unverifiable.
    return documentAuthors.map((a) => ({
      name: a.name,
      pubkeyHex: '',
      signature: 'unverifiable' as const,
      label: undefined,
    }));
  }

  return witnesses.map((w) => {
    const docAuthor = documentAuthors[w.authorIndex];
    return {
      name: w.authorName ?? docAuthor?.name,
      pubkeyHex: w.publicKey,
      signature: w.signatureValid ? 'valid' : 'invalid',
      label: lookupAuthorLabel(w.publicKey, network),
    };
  });
}

export async function validateGovernanceMetadata(
  input: ValidatorInput,
): Promise<Omit<ResolvedGovernanceMetadata, 'cip169'>> {
  const standard = detectCipStandard(input.document);
  const detectedCip = detectedToType(standard);
  const hasCip169Extension = detectCip169Extension(input.document);

  const rawBytes = hexToBytes(input.rawHex);
  const verifyFn = pickVerify(standard);

  let verifyResult: Result<VerificationResult, GovernanceMetadataError>;
  try {
    verifyResult = await verifyFn(
      { document: input.document, rawBytes },
      { anchorHash: input.dataHash },
    );
  } catch (err) {
    return {
      rawHex: input.rawHex,
      document: input.document,
      detectedCip,
      hasCip169Extension,
      hashOk: input.hashOk,
      computedHash: input.computedHash,
      schemaIssues: issuesFromError(err),
      authors: [],
    };
  }

  if (!verifyResult.success) {
    return {
      rawHex: input.rawHex,
      document: input.document,
      detectedCip,
      hasCip169Extension,
      hashOk: input.hashOk,
      computedHash: input.computedHash,
      schemaIssues: issuesFromError(verifyResult.error),
      authors: authorsFromVerification(undefined, input.document, input.network),
    };
  }

  return {
    rawHex: input.rawHex,
    document: input.document,
    detectedCip,
    hasCip169Extension,
    hashOk: input.hashOk,
    computedHash: input.computedHash,
    schemaIssues: [],
    authors: authorsFromVerification(verifyResult.data, input.document, input.network),
  };
}
