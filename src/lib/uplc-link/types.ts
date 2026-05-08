// src/lib/uplc-link/types.ts
// Mirrors the public API DTOs at https://api.uplc.link (OpenAPI v3 spec).

export type UplcPlutusVersion = 'V1' | 'V2' | 'V3';
export type UplcParameterizationStatus = 'COMPLETE' | 'PARTIAL';

export interface UplcScript {
  scriptName: string;
  moduleName?: string;
  validatorName: string;
  purposes: string[];
  rawHash: string;
  finalHash: string;
  plutusVersion: UplcPlutusVersion;
  parameterizationStatus: UplcParameterizationStatus;
  requiredParameters: unknown[];
  providedParameters: string[];
}

export interface UplcScriptListResponse {
  txHash: string;
  sourceUrl: string;
  commitHash: string;
  sourcePath?: string;
  compilerType: string;       // e.g. "AIKEN"
  compilerVersion: string;
  status: string;             // e.g. "VERIFIED"
  scripts: UplcScript[];
}

export type UplcMatchKind = 'rawHash' | 'finalHash';

export type UplcLookup =
  | { state: 'loading' }
  | {
      state: 'verified';
      data: UplcScriptListResponse;
      matchedScript: UplcScript;
      matchKind: UplcMatchKind;
    }
  | { state: 'not-verified' }
  | { state: 'error'; message: string };
