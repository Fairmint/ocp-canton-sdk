/** Exact built-declaration contracts for stock corporate-action SDK surfaces. */

import type { OcpClient } from '../../dist/OcpClient';
import type {
  DamlDataTypeFor,
  OcfCreateDataFor,
  OcfEditDataFor,
} from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfEditDataFromOperation,
} from '../../dist/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../dist/functions/OpenCapTable/capTable/ocfToDaml';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../dist/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import { stockClassSplitDataToDaml } from '../../dist/functions/OpenCapTable/stockClassSplit/stockClassSplitDataToDaml';
import { stockConsolidationDataToDaml } from '../../dist/functions/OpenCapTable/stockConsolidation/stockConsolidationDataToDaml';
import { stockReissuanceDataToDaml } from '../../dist/functions/OpenCapTable/stockReissuance/stockReissuanceDataToDaml';
import { stockRepurchaseDataToDaml } from '../../dist/functions/OpenCapTable/stockRepurchase/stockRepurchaseDataToDaml';
import type {
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockReissuance,
  OcfStockRepurchase,
} from '../../dist/types/native';

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
const createSplit = buildOcfCreateDataFromOperation({ type: 'stockClassSplit', data: split });
const createConsolidation = buildOcfCreateData('stockConsolidation', consolidation);
const editReissuance = buildOcfEditDataFromOperation({ type: 'stockReissuance', data: reissuance });
const editRepurchase = buildOcfEditDataFromOperation({ type: 'stockRepurchase', data: repurchase });

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

const builtWriterTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof directRatio, DamlDataTypeFor<'stockClassConversionRatioAdjustment'>>,
      IsExactly<typeof directSplit, DamlDataTypeFor<'stockClassSplit'>>,
      IsExactly<typeof directConsolidation, DamlDataTypeFor<'stockConsolidation'>>,
      IsExactly<typeof directReissuance, DamlDataTypeFor<'stockReissuance'>>,
      IsExactly<typeof directRepurchase, DamlDataTypeFor<'stockRepurchase'>>,
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
const builtBatchTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof createRatio, OcfCreateDataFor<'stockClassConversionRatioAdjustment'>>,
      IsExactly<typeof createSplit, OcfCreateDataFor<'stockClassSplit'>>,
      IsExactly<typeof createConsolidation, OcfCreateDataFor<'stockConsolidation'>>,
      IsExactly<typeof editReissuance, OcfEditDataFor<'stockReissuance'>>,
      IsExactly<typeof editRepurchase, OcfEditDataFor<'stockRepurchase'>>,
    ]
  >
> = true;
const builtClientTypesAreExact: Assert<
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
const builtCardinalityAndScalarTypesAreExact: Assert<
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
// @ts-expect-error built consolidation security_ids are statically non-empty
const emptyConsolidationSources: OcfStockConsolidation['security_ids'] = [];
// @ts-expect-error built generic writers preserve entity/data correlation
convertToDaml('stockClassSplit', consolidation);
// @ts-expect-error built operation writers preserve entity/data correlation
convertOperationToDaml({ type: 'stockRepurchase', data: reissuance });
// @ts-expect-error built batch writers preserve entity/data correlation
buildOcfCreateData('stockConsolidation', split);

void builtWriterTypesAreExact;
void builtBatchTypesAreExact;
void builtClientTypesAreExact;
void builtCardinalityAndScalarTypesAreExact;
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
void createSplit;
void createConsolidation;
void editReissuance;
void editRepurchase;
void clientRatio;
void clientSplit;
void clientConsolidation;
void clientReissuance;
void clientRepurchase;
void emptyReissuanceResults;
void emptyConsolidationSources;
