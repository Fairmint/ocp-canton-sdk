/** Built-declaration contracts for runtime-validated DAML map keys and values. */

import { parseDamlMap, type DamlMapSchema } from '../../dist/utils/typeConversions';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

declare const unknownLedgerMap: unknown;

type Identifier = `id-${string}`;

const stringEntries = {
  key: {
    expectedType: 'id-prefixed string',
    is: (value: unknown): value is Identifier => typeof value === 'string' && value.startsWith('id-'),
  },
  value: {
    expectedType: 'string',
    is: (value: unknown): value is string => typeof value === 'string',
  },
} satisfies DamlMapSchema<Identifier, string>;

const parsed = parseDamlMap(unknownLedgerMap, stringEntries);
const inferredEntryTypeIsExact: Assert<IsExactly<typeof parsed, Array<[Identifier, string]>>> = true;
const inferredKeyTypeIsNotAny: Assert<IsExactly<IsAny<(typeof parsed)[number][0]>, false>> = true;
const inferredValueTypeIsNotAny: Assert<IsExactly<IsAny<(typeof parsed)[number][1]>, false>> = true;
const legacyValueOnlySchema = {
  expectedType: 'string',
  isValue: (value: unknown): value is string => typeof value === 'string',
};

// @ts-expect-error built declarations require runtime key and value schemas
parseDamlMap(unknownLedgerMap);

// @ts-expect-error built declarations reject the legacy value-only schema
parseDamlMap(unknownLedgerMap, legacyValueOnlySchema);

// @ts-expect-error built declarations reject caller-selected types that disagree with runtime guards
parseDamlMap<'other-id', { contractId: string }>(unknownLedgerMap, stringEntries);

void parsed;
void inferredEntryTypeIsExact;
void inferredKeyTypeIsNotAny;
void inferredValueTypeIsNotAny;
void legacyValueOnlySchema;
