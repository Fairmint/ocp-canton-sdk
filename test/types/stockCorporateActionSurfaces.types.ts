/** Exact source contracts for stock corporate-action writers, operations, batches, and OcpClient. */

import type { OcpClient } from '../../src/OcpClient';
import type {
  DamlDataTypeFor,
  OcfCreateDataFor,
  OcfEditDataFor,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfEditData,
  buildOcfEditDataFromOperation,
} from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import { stockClassSplitDataToDaml } from '../../src/functions/OpenCapTable/stockClassSplit/stockClassSplitDataToDaml';
import { stockConsolidationDataToDaml } from '../../src/functions/OpenCapTable/stockConsolidation/stockConsolidationDataToDaml';
import { stockReissuanceDataToDaml } from '../../src/functions/OpenCapTable/stockReissuance/stockReissuanceDataToDaml';
import { stockRepurchaseDataToDaml } from '../../src/functions/OpenCapTable/stockRepurchase/stockRepurchaseDataToDaml';
import type {
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockReissuance,
  OcfStockRepurchase,
} from '../../src/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type EveryTrue<T extends readonly boolean[]> = Exclude<T[number], true> extends never ? true : false;
type DirectNumberKeys<T> = {
  [Key in keyof T]-?: Extract<T[Key], number> extends never ? never : Key;
}[keyof T];

declare const ratio: OcfStockClassConversionRatioAdjustment;
declare const split: OcfStockClassSplit;
declare const consolidation: OcfStockConsolidation;
declare const reissuance: OcfStockReissuance;
declare const repurchase: OcfStockRepurchase;
declare const client: OcpClient;

const directRatio = stockClassConversionRatioAdjustmentDataToDaml(ratio);
const directSplit = stockClassSplitDataToDaml(split);
const directConsolidation = stockConsolidationDataToDaml(consolidation);
const directReissuance = stockReissuanceDataToDaml(reissuance);
const directRepurchase = stockRepurchaseDataToDaml(repurchase);
const genericRatio = convertToDaml('stockClassConversionRatioAdjustment', ratio);
const genericSplit = convertToDaml('stockClassSplit', split);
const genericConsolidation = convertToDaml('stockConsolidation', consolidation);
const genericReissuance = convertToDaml('stockReissuance', reissuance);
const genericRepurchase = convertToDaml('stockRepurchase', repurchase);
const operationRatio = convertOperationToDaml({ type: 'stockClassConversionRatioAdjustment', data: ratio });
const operationSplit = convertOperationToDaml({ type: 'stockClassSplit', data: split });
const operationConsolidation = convertOperationToDaml({ type: 'stockConsolidation', data: consolidation });
const operationReissuance = convertOperationToDaml({ type: 'stockReissuance', data: reissuance });
const operationRepurchase = convertOperationToDaml({ type: 'stockRepurchase', data: repurchase });

const createRatio = buildOcfCreateData('stockClassConversionRatioAdjustment', ratio);
const createSplitOperation = buildOcfCreateDataFromOperation({ type: 'stockClassSplit', data: split });
const createConsolidation = buildOcfCreateData('stockConsolidation', consolidation);
const editReissuance = buildOcfEditData('stockReissuance', reissuance);
const editRepurchaseOperation = buildOcfEditDataFromOperation({ type: 'stockRepurchase', data: repurchase });

const clientRatio = client.OpenCapTable.stockClassConversionRatioAdjustment.get({ contractId: 'contract-id' });
const clientSplit = client.OpenCapTable.stockClassSplit.get({ contractId: 'contract-id' });
const clientConsolidation = client.OpenCapTable.getByObjectType({
  objectType: 'TX_STOCK_CONSOLIDATION',
  contractId: 'contract-id',
});
const clientReissuance = client.OpenCapTable.getByObjectType({
  objectType: 'TX_STOCK_REISSUANCE',
  contractId: 'contract-id',
});
const clientRepurchase = client.OpenCapTable.stockRepurchase.get({ contractId: 'contract-id' });

const directWriterTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof directRatio, DamlDataTypeFor<'stockClassConversionRatioAdjustment'>>,
      IsExactly<typeof directSplit, DamlDataTypeFor<'stockClassSplit'>>,
      IsExactly<typeof directConsolidation, DamlDataTypeFor<'stockConsolidation'>>,
      IsExactly<typeof directReissuance, DamlDataTypeFor<'stockReissuance'>>,
      IsExactly<typeof directRepurchase, DamlDataTypeFor<'stockRepurchase'>>,
    ]
  >
> = true;
const dispatcherAndOperationTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof genericRatio, DamlDataTypeFor<'stockClassConversionRatioAdjustment'>>,
      IsExactly<typeof genericSplit, DamlDataTypeFor<'stockClassSplit'>>,
      IsExactly<typeof genericConsolidation, DamlDataTypeFor<'stockConsolidation'>>,
      IsExactly<typeof genericReissuance, DamlDataTypeFor<'stockReissuance'>>,
      IsExactly<typeof genericRepurchase, DamlDataTypeFor<'stockRepurchase'>>,
      IsExactly<typeof operationRatio, DamlDataTypeFor<'stockClassConversionRatioAdjustment'>>,
      IsExactly<typeof operationSplit, DamlDataTypeFor<'stockClassSplit'>>,
      IsExactly<typeof operationConsolidation, DamlDataTypeFor<'stockConsolidation'>>,
      IsExactly<typeof operationReissuance, DamlDataTypeFor<'stockReissuance'>>,
      IsExactly<typeof operationRepurchase, DamlDataTypeFor<'stockRepurchase'>>,
    ]
  >
> = true;
const batchTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof createRatio, OcfCreateDataFor<'stockClassConversionRatioAdjustment'>>,
      IsExactly<typeof createSplitOperation, OcfCreateDataFor<'stockClassSplit'>>,
      IsExactly<typeof createConsolidation, OcfCreateDataFor<'stockConsolidation'>>,
      IsExactly<typeof editReissuance, OcfEditDataFor<'stockReissuance'>>,
      IsExactly<typeof editRepurchaseOperation, OcfEditDataFor<'stockRepurchase'>>,
    ]
  >
> = true;
const clientTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<Awaited<typeof clientRatio>['data'], OcfStockClassConversionRatioAdjustment>,
      IsExactly<Awaited<typeof clientSplit>['data'], OcfStockClassSplit>,
      IsExactly<Awaited<typeof clientConsolidation>['data'], OcfStockConsolidation>,
      IsExactly<Awaited<typeof clientReissuance>['data'], OcfStockReissuance>,
      IsExactly<Awaited<typeof clientRepurchase>['data'], OcfStockRepurchase>,
      IsExactly<IsAny<Awaited<typeof clientRepurchase>['data']>, false>,
    ]
  >
> = true;
const cardinalityAndDamlScalarTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<OcfStockConsolidation['security_ids'], [string, ...string[]]>,
      IsExactly<OcfStockConsolidation['resulting_security_id'], string>,
      IsExactly<OcfStockReissuance['resulting_security_ids'], string[]>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'stockClassConversionRatioAdjustment'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'stockClassSplit'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'stockConsolidation'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'stockReissuance'>>, never>,
      IsExactly<DirectNumberKeys<DamlDataTypeFor<'stockRepurchase'>>, never>,
    ]
  >
> = true;

const emptyReissuanceResults: OcfStockReissuance['resulting_security_ids'] = [];
// @ts-expect-error consolidation security_ids are statically non-empty
const emptyConsolidationSources: OcfStockConsolidation['security_ids'] = [];
// @ts-expect-error generic writers preserve entity/data correlation
convertToDaml('stockClassSplit', consolidation);
// @ts-expect-error operation writers preserve entity/data correlation
convertOperationToDaml({ type: 'stockRepurchase', data: reissuance });
// @ts-expect-error batch writers preserve entity/data correlation
buildOcfCreateData('stockConsolidation', split);
// @ts-expect-error generated Numeric fields remain strings, never JavaScript numbers
const invalidSplitNumerator: DamlDataTypeFor<'stockClassSplit'>['split_ratio']['numerator'] = 2;

void directWriterTypesAreExact;
void dispatcherAndOperationTypesAreExact;
void batchTypesAreExact;
void clientTypesAreExact;
void cardinalityAndDamlScalarTypesAreExact;
void directRatio;
void directSplit;
void directConsolidation;
void directReissuance;
void directRepurchase;
void genericRatio;
void genericSplit;
void genericConsolidation;
void genericReissuance;
void genericRepurchase;
void operationRatio;
void operationSplit;
void operationConsolidation;
void operationReissuance;
void operationRepurchase;
void createRatio;
void createSplitOperation;
void createConsolidation;
void editReissuance;
void editRepurchaseOperation;
void clientRatio;
void clientSplit;
void clientConsolidation;
void clientReissuance;
void clientRepurchase;
void emptyReissuanceResults;
void emptyConsolidationSources;
void invalidSplitNumerator;
