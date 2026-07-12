/** Compile-time contracts for canonicalization helpers in the built SDK declarations. */

import { deepNormalizeNumericStrings, normalizeOcfData } from '../../dist/utils/ocfNormalization';

const normalizedNumericString: string = deepNormalizeNumericStrings('1.00' as const);
void normalizedNumericString;

// @ts-expect-error built declarations must not preserve a numeric string literal that can be rewritten
const staleNumericLiteral: '1.00' = deepNormalizeNumericStrings('1.00' as const);
void staleNumericLiteral;

declare const ocfData: Record<string, unknown>;
const normalizedData: Record<string, unknown> = normalizeOcfData(ocfData);
void normalizedData;
