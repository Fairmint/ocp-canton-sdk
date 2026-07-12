/** Compile-time contracts for administrative adjustment readers and public facade correlations. */

import type {
  OcfIssuerAuthorizedSharesAdjustmentOutput,
  OcfStockClassAuthorizedSharesAdjustmentOutput,
  OcfStockPlanPoolAdjustmentOutput,
  OcpClient,
} from '../../src';
import type { DamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { ReadonlyDamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/damlEntityData';
import type { issuerAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import type {
  DamlIssuerAuthorizedSharesAdjustmentData,
  GetIssuerAuthorizedSharesAdjustmentAsOcfResult,
} from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import type { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import type {
  DamlStockClassAuthorizedSharesAdjustmentData,
  GetStockClassAuthorizedSharesAdjustmentAsOcfResult,
} from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/getStockClassAuthorizedSharesAdjustmentAsOcf';
import type { stockPlanPoolAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import type {
  DamlStockPlanPoolAdjustmentData,
  GetStockPlanPoolAdjustmentAsOcfResult,
} from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/getStockPlanPoolAdjustmentAsOcf';
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type IssuerEvent = GetIssuerAuthorizedSharesAdjustmentAsOcfResult['event'];
type StockClassEvent = GetStockClassAuthorizedSharesAdjustmentAsOcfResult['event'];
type StockPlanEvent = GetStockPlanPoolAdjustmentAsOcfResult['event'];
type PublicOpenCapTable = OcpClient['OpenCapTable'];
type PublicIssuerData = Awaited<ReturnType<PublicOpenCapTable['issuerAuthorizedSharesAdjustment']['get']>>['data'];
type PublicStockClassData = Awaited<
  ReturnType<PublicOpenCapTable['stockClassAuthorizedSharesAdjustment']['get']>
>['data'];
type PublicStockPlanData = Awaited<ReturnType<PublicOpenCapTable['stockPlanPoolAdjustment']['get']>>['data'];

const issuerEventIsExact: Assert<IsExactly<IssuerEvent, OcfIssuerAuthorizedSharesAdjustmentOutput>> = true;
const stockClassEventIsExact: Assert<IsExactly<StockClassEvent, OcfStockClassAuthorizedSharesAdjustmentOutput>> = true;
const stockPlanEventIsExact: Assert<IsExactly<StockPlanEvent, OcfStockPlanPoolAdjustmentOutput>> = true;
const issuerResultIsExact: Assert<
  IsExactly<
    GetIssuerAuthorizedSharesAdjustmentAsOcfResult,
    { readonly event: OcfIssuerAuthorizedSharesAdjustmentOutput; readonly contractId: string }
  >
> = true;
const stockClassResultIsExact: Assert<
  IsExactly<
    GetStockClassAuthorizedSharesAdjustmentAsOcfResult,
    { readonly event: OcfStockClassAuthorizedSharesAdjustmentOutput; readonly contractId: string }
  >
> = true;
const stockPlanResultIsExact: Assert<
  IsExactly<
    GetStockPlanPoolAdjustmentAsOcfResult,
    { readonly event: OcfStockPlanPoolAdjustmentOutput; readonly contractId: string }
  >
> = true;
const issuerEventIsNotAny: Assert<IsExactly<IsAny<IssuerEvent>, false>> = true;
const stockClassEventIsNotAny: Assert<IsExactly<IsAny<StockClassEvent>, false>> = true;
const stockPlanEventIsNotAny: Assert<IsExactly<IsAny<StockPlanEvent>, false>> = true;
const publicIssuerIsExact: Assert<IsExactly<PublicIssuerData, OcfIssuerAuthorizedSharesAdjustmentOutput>> = true;
const publicStockClassIsExact: Assert<IsExactly<PublicStockClassData, OcfStockClassAuthorizedSharesAdjustmentOutput>> =
  true;
const publicStockPlanIsExact: Assert<IsExactly<PublicStockPlanData, OcfStockPlanPoolAdjustmentOutput>> = true;

const issuerDamlIsExact: Assert<
  IsExactly<DamlIssuerAuthorizedSharesAdjustmentData, ReadonlyDamlDataTypeFor<'issuerAuthorizedSharesAdjustment'>>
> = true;
const stockClassDamlIsExact: Assert<
  IsExactly<
    DamlStockClassAuthorizedSharesAdjustmentData,
    ReadonlyDamlDataTypeFor<'stockClassAuthorizedSharesAdjustment'>
  >
> = true;
const stockPlanDamlIsExact: Assert<
  IsExactly<DamlStockPlanPoolAdjustmentData, ReadonlyDamlDataTypeFor<'stockPlanPoolAdjustment'>>
> = true;
const issuerWriterIsExact: Assert<
  IsExactly<
    ReturnType<typeof issuerAuthorizedSharesAdjustmentDataToDaml>,
    DamlDataTypeFor<'issuerAuthorizedSharesAdjustment'>
  >
> = true;
const stockClassWriterIsExact: Assert<
  IsExactly<
    ReturnType<typeof stockClassAuthorizedSharesAdjustmentDataToDaml>,
    DamlDataTypeFor<'stockClassAuthorizedSharesAdjustment'>
  >
> = true;
const stockPlanWriterIsExact: Assert<
  IsExactly<ReturnType<typeof stockPlanPoolAdjustmentDataToDaml>, DamlDataTypeFor<'stockPlanPoolAdjustment'>>
> = true;
type HasStringIndex<T> = string extends keyof T ? true : false;
const issuerWriterHasNoIndexSignature: Assert<
  IsExactly<HasStringIndex<ReturnType<typeof issuerAuthorizedSharesAdjustmentDataToDaml>>, false>
> = true;
const stockClassWriterHasNoIndexSignature: Assert<
  IsExactly<HasStringIndex<ReturnType<typeof stockClassAuthorizedSharesAdjustmentDataToDaml>>, false>
> = true;
const stockPlanWriterHasNoIndexSignature: Assert<
  IsExactly<HasStringIndex<ReturnType<typeof stockPlanPoolAdjustmentDataToDaml>>, false>
> = true;

declare const issuerResult: GetIssuerAuthorizedSharesAdjustmentAsOcfResult;
declare const stockClassResult: GetStockClassAuthorizedSharesAdjustmentAsOcfResult;
declare const stockPlanResult: GetStockPlanPoolAdjustmentAsOcfResult;
declare const ocp: OcpClient;
declare const publicIssuerData: PublicIssuerData;
declare const publicStockClassData: PublicStockClassData;
declare const publicStockPlanData: PublicStockPlanData;

const issuerByObjectTypeResult = ocp.OpenCapTable.getByObjectType({
  objectType: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
  contractId: 'issuer-adjustment-cid',
});
const stockClassByObjectTypeResult = ocp.OpenCapTable.getByObjectType({
  objectType: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
  contractId: 'stock-class-adjustment-cid',
});
const stockPlanByObjectTypeResult = ocp.OpenCapTable.getByObjectType({
  objectType: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
  contractId: 'stock-plan-adjustment-cid',
});
type IssuerByObjectTypeData = Awaited<typeof issuerByObjectTypeResult>['data'];
type StockClassByObjectTypeData = Awaited<typeof stockClassByObjectTypeResult>['data'];
type StockPlanByObjectTypeData = Awaited<typeof stockPlanByObjectTypeResult>['data'];
const issuerByObjectTypeIsExact: Assert<IsExactly<IssuerByObjectTypeData, OcfIssuerAuthorizedSharesAdjustmentOutput>> =
  true;
const stockClassByObjectTypeIsExact: Assert<
  IsExactly<StockClassByObjectTypeData, OcfStockClassAuthorizedSharesAdjustmentOutput>
> = true;
const stockPlanByObjectTypeIsExact: Assert<IsExactly<StockPlanByObjectTypeData, OcfStockPlanPoolAdjustmentOutput>> =
  true;

// @ts-expect-error issuer adjustment cannot be used as a stock-class adjustment
const wrongStockClass: OcfStockClassAuthorizedSharesAdjustmentOutput = issuerResult.event;
// @ts-expect-error stock-class adjustment cannot be used as a stock-plan pool adjustment
const wrongStockPlan: OcfStockPlanPoolAdjustmentOutput = stockClassResult.event;
// @ts-expect-error stock-plan pool adjustment cannot be used as an issuer adjustment
const wrongIssuer: OcfIssuerAuthorizedSharesAdjustmentOutput = stockPlanResult.event;
// @ts-expect-error root OcpClient issuer adjustment data cannot be used as a stock-class adjustment
const wrongPublicStockClass: OcfStockClassAuthorizedSharesAdjustmentOutput = publicIssuerData;
// @ts-expect-error root OcpClient stock-class adjustment data cannot be used as a stock-plan adjustment
const wrongPublicStockPlan: OcfStockPlanPoolAdjustmentOutput = publicStockClassData;
// @ts-expect-error root OcpClient stock-plan adjustment data cannot be used as an issuer adjustment
const wrongPublicIssuer: OcfIssuerAuthorizedSharesAdjustmentOutput = publicStockPlanData;
// @ts-expect-error reader event fields are immutable
issuerResult.event.id = 'mutated';
// @ts-expect-error nested reader arrays are immutable
issuerResult.event.comments?.push('mutated');
// @ts-expect-error reader result wrappers are immutable
issuerResult.contractId = 'mutated';

void issuerEventIsExact;
void stockClassEventIsExact;
void stockPlanEventIsExact;
void issuerResultIsExact;
void stockClassResultIsExact;
void stockPlanResultIsExact;
void issuerEventIsNotAny;
void stockClassEventIsNotAny;
void stockPlanEventIsNotAny;
void publicIssuerIsExact;
void publicStockClassIsExact;
void publicStockPlanIsExact;
void issuerDamlIsExact;
void stockClassDamlIsExact;
void stockPlanDamlIsExact;
void issuerWriterIsExact;
void stockClassWriterIsExact;
void stockPlanWriterIsExact;
void issuerWriterHasNoIndexSignature;
void stockClassWriterHasNoIndexSignature;
void stockPlanWriterHasNoIndexSignature;
void wrongStockClass;
void wrongStockPlan;
void wrongIssuer;
void issuerByObjectTypeResult;
void stockClassByObjectTypeResult;
void stockPlanByObjectTypeResult;
void issuerByObjectTypeIsExact;
void stockClassByObjectTypeIsExact;
void stockPlanByObjectTypeIsExact;
void wrongPublicStockClass;
void wrongPublicStockPlan;
void wrongPublicIssuer;
