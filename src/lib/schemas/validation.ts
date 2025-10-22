// src/lib/schemas/validation.ts
import { z } from 'zod';

export const hexStringSchema = z.string().regex(/^[0-9a-fA-F]+$/, 'Must be a valid hex string');

export const txHexSchema = z.string()
  .min(1, 'Transaction hex is required')
  .regex(/^[0-9a-fA-F]+$/, 'Must be a valid hex string')
  .refine((hex) => hex.length % 2 === 0, 'Hex string must have even length')
  .refine((hex) => hex.length >= 100, 'Transaction hex too short to be valid');

export const networkSchema = z.enum(['mainnet', 'preprod', 'preview', 'testnet']);

export const urlParamsSchema = z.object({
  hex: txHexSchema.optional(),
  net: networkSchema.optional(),
});

export type UrlParams = z.infer<typeof urlParamsSchema>;
