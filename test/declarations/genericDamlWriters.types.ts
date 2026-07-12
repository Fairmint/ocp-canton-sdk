/** Built-declaration contracts for correlated immutable generic DAML writers. */

import type { OcfConvertibleIssuance, OcfStockIssuance, PersistedOcfWarrantIssuance } from '../../dist';
import type { ReadonlyDamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import { convertOperationToDaml, convertToDaml } from '../../dist/functions/OpenCapTable/capTable/ocfToDaml';

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

// @ts-expect-error built generic output remains correlated to the requested entity
const wrongEntity: ReadonlyDamlDataTypeFor<'warrantIssuance'> = convertible;
// @ts-expect-error built top-level generated fields are readonly
convertible.id = 'replacement';
// @ts-expect-error built nested generated records are readonly
convertible.investment_amount.amount = '2';
// @ts-expect-error built nested generated lists are readonly
convertible.conversion_triggers.length = 0;
// @ts-expect-error built deeply nested generated list items are readonly
stock.vestings[0].amount = '2';
// @ts-expect-error built operation-based output is recursively readonly too
warrantOperation.exercise_triggers.length = 0;

void convertibleIsExact;
void stockIsExact;
void warrantOperationIsExact;
void wrongEntity;
