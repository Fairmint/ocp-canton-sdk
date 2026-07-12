/** Exact source contracts for conversion/exercise writers, operations, batches, and OcpClient. */

import type { OcpClient } from '../../src/OcpClient';
import type {
  DamlDataTypeFor,
  OcfCreateDataFor,
  OcfEditDataFor,
  ReadonlyDamlDataTypeFor,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfEditData,
  buildOcfEditDataFromOperation,
} from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { convertibleConversionDataToDaml } from '../../src/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { equityCompensationExerciseDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationExercise/createEquityCompensationExercise';
import { stockConversionDataToDaml } from '../../src/functions/OpenCapTable/stockConversion/stockConversionDataToDaml';
import { warrantExerciseDataToDaml } from '../../src/functions/OpenCapTable/warrantExercise/warrantExerciseDataToDaml';
import type { DeepReadonly } from '../../src/types/common';
import type {
  NonEmptyArray,
  OcfConvertibleConversion,
  OcfEquityCompensationExercise,
  OcfStockConversion,
  OcfWarrantExercise,
} from '../../src/types/native';

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
const createStock = buildOcfCreateData('stockConversion', stock);
const createEquity = buildOcfCreateData('equityCompensationExercise', equity);
const createWarrant = buildOcfCreateData('warrantExercise', warrant);
const createConvertibleOperation = buildOcfCreateDataFromOperation({
  type: 'convertibleConversion',
  data: convertible,
});
const editStock = buildOcfEditData('stockConversion', stock);
const editEquityOperation = buildOcfEditDataFromOperation({
  type: 'equityCompensationExercise',
  data: equity,
});

const clientConvertible = client.OpenCapTable.convertibleConversion.get({ contractId: 'contract-id' });
const clientStock = client.OpenCapTable.stockConversion.get({ contractId: 'contract-id' });
const clientEquity = client.OpenCapTable.equityCompensationExercise.get({ contractId: 'contract-id' });
const clientWarrant = client.OpenCapTable.warrantExercise.get({ contractId: 'contract-id' });
const objectTypeConvertible = client.OpenCapTable.getByObjectType({
  objectType: 'TX_CONVERTIBLE_CONVERSION',
  contractId: 'contract-id',
});
const objectTypeStock = client.OpenCapTable.getByObjectType({
  objectType: 'TX_STOCK_CONVERSION',
  contractId: 'contract-id',
});
const objectTypeEquity = client.OpenCapTable.getByObjectType({
  objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
  contractId: 'contract-id',
});
const objectTypeWarrant = client.OpenCapTable.getByObjectType({
  objectType: 'TX_WARRANT_EXERCISE',
  contractId: 'contract-id',
});

const directWriterTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof directConvertible, DamlDataTypeFor<'convertibleConversion'>>,
      IsExactly<typeof directStock, DamlDataTypeFor<'stockConversion'>>,
      IsExactly<typeof directEquity, DamlDataTypeFor<'equityCompensationExercise'>>,
      IsExactly<typeof directWarrant, DamlDataTypeFor<'warrantExercise'>>,
    ]
  >
> = true;
const genericWriterTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof genericConvertible, ReadonlyDamlDataTypeFor<'convertibleConversion'>>,
      IsExactly<typeof genericStock, ReadonlyDamlDataTypeFor<'stockConversion'>>,
      IsExactly<typeof genericEquity, ReadonlyDamlDataTypeFor<'equityCompensationExercise'>>,
      IsExactly<typeof genericWarrant, ReadonlyDamlDataTypeFor<'warrantExercise'>>,
    ]
  >
> = true;
const operationWriterTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof operationConvertible, ReadonlyDamlDataTypeFor<'convertibleConversion'>>,
      IsExactly<typeof operationStock, ReadonlyDamlDataTypeFor<'stockConversion'>>,
      IsExactly<typeof operationEquity, ReadonlyDamlDataTypeFor<'equityCompensationExercise'>>,
      IsExactly<typeof operationWarrant, ReadonlyDamlDataTypeFor<'warrantExercise'>>,
    ]
  >
> = true;
const batchTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof createConvertible, OcfCreateDataFor<'convertibleConversion'>>,
      IsExactly<typeof createStock, OcfCreateDataFor<'stockConversion'>>,
      IsExactly<typeof createEquity, OcfCreateDataFor<'equityCompensationExercise'>>,
      IsExactly<typeof createWarrant, OcfCreateDataFor<'warrantExercise'>>,
      IsExactly<typeof createConvertibleOperation, OcfCreateDataFor<'convertibleConversion'>>,
      IsExactly<typeof editStock, OcfEditDataFor<'stockConversion'>>,
      IsExactly<typeof editEquityOperation, OcfEditDataFor<'equityCompensationExercise'>>,
    ]
  >
> = true;

const clientReaderTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<Awaited<typeof clientConvertible>['data'], DeepReadonly<OcfConvertibleConversion>>,
      IsExactly<Awaited<typeof clientStock>['data'], DeepReadonly<OcfStockConversion>>,
      IsExactly<Awaited<typeof clientEquity>['data'], DeepReadonly<OcfEquityCompensationExercise>>,
      IsExactly<Awaited<typeof clientWarrant>['data'], DeepReadonly<OcfWarrantExercise>>,
      IsExactly<Awaited<typeof objectTypeConvertible>['data'], DeepReadonly<OcfConvertibleConversion>>,
      IsExactly<Awaited<typeof objectTypeStock>['data'], DeepReadonly<OcfStockConversion>>,
      IsExactly<Awaited<typeof objectTypeEquity>['data'], DeepReadonly<OcfEquityCompensationExercise>>,
      IsExactly<Awaited<typeof objectTypeWarrant>['data'], DeepReadonly<OcfWarrantExercise>>,
    ]
  >
> = true;

const outputsAreNotAny: Assert<
  EveryTrue<
    [
      IsExactly<IsAny<typeof genericConvertible>, false>,
      IsExactly<IsAny<typeof operationStock>, false>,
      IsExactly<IsAny<typeof createEquity>, false>,
      IsExactly<IsAny<Awaited<typeof objectTypeWarrant>['data']>, false>,
    ]
  >
> = true;
const resultingSecurityIdsMatchPinnedCardinality: Assert<
  EveryTrue<
    [
      IsExactly<OcfConvertibleConversion['resulting_security_ids'], NonEmptyArray<string>>,
      IsExactly<OcfStockConversion['resulting_security_ids'], NonEmptyArray<string>>,
      IsExactly<OcfEquityCompensationExercise['resulting_security_ids'], string[]>,
      IsExactly<OcfWarrantExercise['resulting_security_ids'], NonEmptyArray<string>>,
    ]
  >
> = true;
const generatedDataHasNoDirectIntFields: Assert<
  EveryTrue<
    [
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'convertibleConversion'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'stockConversion'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'equityCompensationExercise'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'warrantExercise'>>, never>,
    ]
  >
> = true;

// @ts-expect-error convertible conversions require at least one resulting security
const emptyConvertibleResults: OcfConvertibleConversion['resulting_security_ids'] = [];
// @ts-expect-error stock conversions require at least one resulting security
const emptyStockResults: OcfStockConversion['resulting_security_ids'] = [];
const emptyEquityResults: OcfEquityCompensationExercise['resulting_security_ids'] = [];
// @ts-expect-error warrant exercises require at least one resulting security
const emptyWarrantResults: OcfWarrantExercise['resulting_security_ids'] = [];

declare const readonlyConvertible: Awaited<typeof clientConvertible>['data'];
declare const readonlyEquity: Awaited<typeof clientEquity>['data'];
declare const readonlyCapitalization: NonNullable<typeof readonlyConvertible.capitalization_definition>;
// Writers remain ergonomic mutable canonical inputs.
convertible.resulting_security_ids.push('another-result');
equity.resulting_security_ids.push('optional-result');
// @ts-expect-error reader objects are recursively readonly
readonlyConvertible.reason_text = 'mutated';
// @ts-expect-error reader result tuples are readonly
readonlyConvertible.resulting_security_ids.push('mutated');
// @ts-expect-error nested reader arrays are readonly
readonlyCapitalization.include_security_ids.push('mutated');
// @ts-expect-error even schema-empty-capable reader arrays are readonly
readonlyEquity.resulting_security_ids.push('mutated');

// @ts-expect-error generic writers preserve entity/data correlation
convertToDaml('stockConversion', convertible);
// @ts-expect-error operation writers preserve entity/data correlation
convertOperationToDaml({ type: 'warrantExercise', data: equity });
// @ts-expect-error batch writers preserve entity/data correlation
buildOcfCreateData('equityCompensationExercise', warrant);
// @ts-expect-error conversion/exercise generated payloads have no JavaScript-number DAML Int fields
const invalidWarrantQuantity: DamlDataTypeFor<'warrantExercise'>['quantity'] = 1;

void directWriterTypesAreExact;
void genericWriterTypesAreExact;
void operationWriterTypesAreExact;
void batchTypesAreExact;
void clientReaderTypesAreExact;
void outputsAreNotAny;
void resultingSecurityIdsMatchPinnedCardinality;
void generatedDataHasNoDirectIntFields;
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
void createStock;
void createEquity;
void createWarrant;
void createConvertibleOperation;
void editStock;
void editEquityOperation;
void clientConvertible;
void clientStock;
void clientEquity;
void clientWarrant;
void objectTypeConvertible;
void objectTypeStock;
void objectTypeEquity;
void objectTypeWarrant;
void emptyConvertibleResults;
void emptyStockResults;
void emptyEquityResults;
void emptyWarrantResults;
void readonlyConvertible;
void readonlyEquity;
void readonlyCapitalization;
void invalidWarrantQuantity;
