/** Compile-time contracts for canonicalization helpers exported from source. */

import { deepNormalizeNumericStrings, normalizeOcfData } from '../../src/utils/ocfNormalization';

const normalizedNumericString: string = deepNormalizeNumericStrings('1.00' as const);
void normalizedNumericString;

// @ts-expect-error numeric normalization can change a string literal's value
const staleNumericLiteral: '1.00' = deepNormalizeNumericStrings('1.00' as const);
void staleNumericLiteral;

declare const ocfData: Record<string, unknown>;
const normalizedData: Record<string, unknown> = normalizeOcfData(ocfData);
void normalizedData;
