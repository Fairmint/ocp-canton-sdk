/** Compile-time contracts for correlated immutable generic DAML writers. */

import type { OcfConvertibleIssuance, OcfStockIssuance, PersistedOcfWarrantIssuance } from '../../src';
import type { ReadonlyDamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertOperationToDaml, convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

declare const convertibleInput: OcfConvertibleIssuance;
declare const stockInput: OcfStockIssuance;
declare const warrantInput: PersistedOcfWarrantIssuance;

const convertible = convertToDaml('convertibleIssuance', convertibleInput);
const stock = convertToDaml('stockIssuance', stockInput);
const warrantOperation = convertOperationToDaml({ type: 'warrantIssuance', data: warrantInput });

const convertibleIsExact: Assert<IsExactly<typeof convertible, ReadonlyDamlDataTypeFor<'convertibleIssuance'>>> = true;
const stockIsExact: Assert<IsExactly<typeof stock, ReadonlyDamlDataTypeFor<'stockIssuance'>>> = true;
const warrantOperationIsExact: Assert<IsExactly<typeof warrantOperation, ReadonlyDamlDataTypeFor<'warrantIssuance'>>> =
  true;

// @ts-expect-error generic output remains correlated to the requested entity
const wrongEntity: ReadonlyDamlDataTypeFor<'warrantIssuance'> = convertible;
// @ts-expect-error top-level generated fields are readonly
convertible.id = 'replacement';
// @ts-expect-error nested generated records are readonly
convertible.investment_amount.amount = '2';
// @ts-expect-error nested generated lists are readonly
convertible.conversion_triggers.length = 0;
// @ts-expect-error deeply nested generated list items are readonly
stock.vestings[0].amount = '2';
// @ts-expect-error operation-based output is recursively readonly too
warrantOperation.exercise_triggers.length = 0;

void convertibleIsExact;
void stockIsExact;
void warrantOperationIsExact;
void wrongEntity;
