/** Exact built-declaration contracts for conversion/exercise SDK surfaces. */

import type { OcpClient } from '../../dist/OcpClient';
import type {
  DamlDataTypeFor,
  OcfCreateDataFor,
  OcfEditDataFor,
} from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfEditData,
  buildOcfEditDataFromOperation,
} from '../../dist/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../dist/functions/OpenCapTable/capTable/ocfToDaml';
import { convertibleConversionDataToDaml } from '../../dist/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { equityCompensationExerciseDataToDaml } from '../../dist/functions/OpenCapTable/equityCompensationExercise/createEquityCompensationExercise';
import { stockConversionDataToDaml } from '../../dist/functions/OpenCapTable/stockConversion/stockConversionDataToDaml';
import { warrantExerciseDataToDaml } from '../../dist/functions/OpenCapTable/warrantExercise/warrantExerciseDataToDaml';
import type { DeepReadonly } from '../../dist/types/common';
import type {
  NonEmptyArray,
  OcfConvertibleConversion,
  OcfEquityCompensationExercise,
  OcfStockConversion,
  OcfWarrantExercise,
} from '../../dist/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type EveryTrue<T extends readonly boolean[]> = Exclude<T[number], true> extends never ? true : false;
type DirectNumberKeys<T> = {
  [Key in keyof T]-?: Extract<T[Key], number> extends never ? never : Key;
}[keyof T];

declare const convertible: OcfConvertibleConversion;
declare const stock: OcfStockConversion;
declare const equity: OcfEquityCompensationExercise;
declare const warrant: OcfWarrantExercise;
declare const client: OcpClient;

const directConvertible = convertibleConversionDataToDaml(convertible);
const directStock = stockConversionDataToDaml(stock);
const directEquity = equityCompensationExerciseDataToDaml(equity);
const directWarrant = warrantExerciseDataToDaml(warrant);
const genericConvertible = convertToDaml('convertibleConversion', convertible);
const genericStock = convertToDaml('stockConversion', stock);
const genericEquity = convertToDaml('equityCompensationExercise', equity);
const genericWarrant = convertToDaml('warrantExercise', warrant);
const operationConvertible = convertOperationToDaml({ type: 'convertibleConversion', data: convertible });
const operationStock = convertOperationToDaml({ type: 'stockConversion', data: stock });
const operationEquity = convertOperationToDaml({ type: 'equityCompensationExercise', data: equity });
const operationWarrant = convertOperationToDaml({ type: 'warrantExercise', data: warrant });
const createConvertible = buildOcfCreateData('convertibleConversion', convertible);
const createStockOperation = buildOcfCreateDataFromOperation({ type: 'stockConversion', data: stock });
const editEquity = buildOcfEditData('equityCompensationExercise', equity);
const editWarrantOperation = buildOcfEditDataFromOperation({ type: 'warrantExercise', data: warrant });

const clientConvertible = client.OpenCapTable.convertibleConversion.get({ contractId: 'contract-id' });
const clientStock = client.OpenCapTable.stockConversion.get({ contractId: 'contract-id' });
const clientEquity = client.OpenCapTable.getByObjectType({
  objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
  contractId: 'contract-id',
});
const clientWarrant = client.OpenCapTable.getByObjectType({
  objectType: 'TX_WARRANT_EXERCISE',
  contractId: 'contract-id',
});

const builtWriterTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof directConvertible, DamlDataTypeFor<'convertibleConversion'>>,
      IsExactly<typeof directStock, DamlDataTypeFor<'stockConversion'>>,
      IsExactly<typeof directEquity, DamlDataTypeFor<'equityCompensationExercise'>>,
      IsExactly<typeof directWarrant, DamlDataTypeFor<'warrantExercise'>>,
      IsExactly<typeof genericConvertible, DamlDataTypeFor<'convertibleConversion'>>,
      IsExactly<typeof genericStock, DamlDataTypeFor<'stockConversion'>>,
      IsExactly<typeof genericEquity, DamlDataTypeFor<'equityCompensationExercise'>>,
      IsExactly<typeof genericWarrant, DamlDataTypeFor<'warrantExercise'>>,
      IsExactly<typeof operationConvertible, DamlDataTypeFor<'convertibleConversion'>>,
      IsExactly<typeof operationStock, DamlDataTypeFor<'stockConversion'>>,
      IsExactly<typeof operationEquity, DamlDataTypeFor<'equityCompensationExercise'>>,
      IsExactly<typeof operationWarrant, DamlDataTypeFor<'warrantExercise'>>,
    ]
  >
> = true;
const builtBatchTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof createConvertible, OcfCreateDataFor<'convertibleConversion'>>,
      IsExactly<typeof createStockOperation, OcfCreateDataFor<'stockConversion'>>,
      IsExactly<typeof editEquity, OcfEditDataFor<'equityCompensationExercise'>>,
      IsExactly<typeof editWarrantOperation, OcfEditDataFor<'warrantExercise'>>,
    ]
  >
> = true;
const builtClientTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<Awaited<typeof clientConvertible>['data'], DeepReadonly<OcfConvertibleConversion>>,
      IsExactly<Awaited<typeof clientStock>['data'], DeepReadonly<OcfStockConversion>>,
      IsExactly<Awaited<typeof clientEquity>['data'], DeepReadonly<OcfEquityCompensationExercise>>,
      IsExactly<Awaited<typeof clientWarrant>['data'], DeepReadonly<OcfWarrantExercise>>,
      IsExactly<IsAny<Awaited<typeof clientWarrant>['data']>, false>,
    ]
  >
> = true;
const builtCardinalityAndIntTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<OcfConvertibleConversion['resulting_security_ids'], NonEmptyArray<string>>,
      IsExactly<OcfStockConversion['resulting_security_ids'], NonEmptyArray<string>>,
      IsExactly<OcfEquityCompensationExercise['resulting_security_ids'], string[]>,
      IsExactly<OcfWarrantExercise['resulting_security_ids'], NonEmptyArray<string>>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'convertibleConversion'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'stockConversion'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'equityCompensationExercise'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'warrantExercise'>>, never>,
    ]
  >
> = true;

// @ts-expect-error built convertible conversions require at least one resulting security
const emptyConvertibleResults: OcfConvertibleConversion['resulting_security_ids'] = [];
// @ts-expect-error built stock conversions require at least one resulting security
const emptyStockResults: OcfStockConversion['resulting_security_ids'] = [];
const emptyEquityResults: OcfEquityCompensationExercise['resulting_security_ids'] = [];
// @ts-expect-error built warrant exercises require at least one resulting security
const emptyWarrantResults: OcfWarrantExercise['resulting_security_ids'] = [];

declare const readonlyConvertible: Awaited<typeof clientConvertible>['data'];
declare const readonlyEquity: Awaited<typeof clientEquity>['data'];
declare const readonlyCapitalization: NonNullable<typeof readonlyConvertible.capitalization_definition>;
// Built writer inputs remain mutable canonical values.
convertible.resulting_security_ids.push('another-result');
equity.resulting_security_ids.push('optional-result');
// @ts-expect-error built reader objects are recursively readonly
readonlyConvertible.reason_text = 'mutated';
// @ts-expect-error built reader result tuples are readonly
readonlyConvertible.resulting_security_ids.push('mutated');
// @ts-expect-error built nested reader arrays are readonly
readonlyCapitalization.include_security_ids.push('mutated');
// @ts-expect-error built empty-capable reader arrays are still readonly
readonlyEquity.resulting_security_ids.push('mutated');

// @ts-expect-error built generic writers preserve entity/data correlation
convertToDaml('stockConversion', convertible);
// @ts-expect-error built operation writers preserve entity/data correlation
convertOperationToDaml({ type: 'warrantExercise', data: equity });
// @ts-expect-error built batch writers preserve entity/data correlation
buildOcfCreateData('equityCompensationExercise', warrant);
// @ts-expect-error generated conversion/exercise payloads expose no JavaScript-number DAML Int
const invalidWarrantQuantity: DamlDataTypeFor<'warrantExercise'>['quantity'] = 1;

void builtWriterTypesAreExact;
void builtBatchTypesAreExact;
void builtClientTypesAreExact;
void builtCardinalityAndIntTypesAreExact;
void directConvertible;
void directStock;
void directEquity;
void directWarrant;
void genericConvertible;
void genericStock;
void genericEquity;
void genericWarrant;
void operationConvertible;
void operationStock;
void operationEquity;
void operationWarrant;
void createConvertible;
void createStockOperation;
void editEquity;
void editWarrantOperation;
void clientConvertible;
void clientStock;
void clientEquity;
void clientWarrant;
void emptyConvertibleResults;
void emptyStockResults;
void emptyEquityResults;
void emptyWarrantResults;
void readonlyConvertible;
void readonlyEquity;
void readonlyCapitalization;
void invalidWarrantQuantity;
