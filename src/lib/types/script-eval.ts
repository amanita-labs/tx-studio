// src/lib/types/script-eval.ts

export interface EvalBudget {
  memory: number;
  cpu: number;
}

export interface EvalResult {
  validator: string; // e.g. "spend:0", "mint:1", "certificate:0", "withdrawal:0"
  budget: EvalBudget;
}

export interface OgmiosError {
  code: number;
  message: string;
  data?: unknown;
}

export interface EvalSuccess {
  success: true;
  results: EvalResult[];
}

export interface EvalFailure {
  success: false;
  error: string;
  ogmiosError?: OgmiosError;
  statusCode?: number;
}

export type EvalResponse = EvalSuccess | EvalFailure;

export interface ProtocolParamsSubset {
  priceMem: number;
  priceStep: number;
  maxTxExMem: number;
  maxTxExSteps: number;
}

export interface ProtocolParamsSuccess {
  success: true;
  params: ProtocolParamsSubset;
}

export interface ProtocolParamsFailure {
  success: false;
  error: string;
}

export type ProtocolParamsResponse = ProtocolParamsSuccess | ProtocolParamsFailure;

export interface ExUnitsDiff {
  declared: { mem: number; steps: number };
  evaluated: { mem: number; steps: number } | null;
  memDiff: number | null; // positive = declared is higher (over-budgeted)
  stepsDiff: number | null;
}

export interface DatumInfo {
  type: 'inline' | 'hash';
  value: string;
  decodedType?: string; // "constr", "map", "list", "int", "bytes"
  decodedContent?: unknown; // structured Plutus Data from CSL
}
