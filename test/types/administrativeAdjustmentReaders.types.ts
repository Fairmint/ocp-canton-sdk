/** Compile-time contracts for administrative adjustment readers and public facade correlations. */

import type {
  OcfIssuerAuthorizedSharesAdjustment,
  OcfStockClassAuthorizedSharesAdjustment,
  OcfStockPlanPoolAdjustment,
  OcpClient,
} from '../../src';
import type { DamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type {
  DamlIssuerAuthorizedSharesAdjustmentData,
  GetIssuerAuthorizedSharesAdjustmentAsOcfResult,
} from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import type {
  DamlStockClassAuthorizedSharesAdjustmentData,
  GetStockClassAuthorizedSharesAdjustmentAsOcfResult,
} from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/getStockClassAuthorizedSharesAdjustmentAsOcf';
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

const issuerEventIsExact: Assert<IsExactly<IssuerEvent, OcfIssuerAuthorizedSharesAdjustment>> = true;
const stockClassEventIsExact: Assert<IsExactly<StockClassEvent, OcfStockClassAuthorizedSharesAdjustment>> = true;
const stockPlanEventIsExact: Assert<IsExactly<StockPlanEvent, OcfStockPlanPoolAdjustment>> = true;
const issuerEventIsNotAny: Assert<IsExactly<IsAny<IssuerEvent>, false>> = true;
const stockClassEventIsNotAny: Assert<IsExactly<IsAny<StockClassEvent>, false>> = true;
const stockPlanEventIsNotAny: Assert<IsExactly<IsAny<StockPlanEvent>, false>> = true;
const publicIssuerIsExact: Assert<IsExactly<PublicIssuerData, OcfIssuerAuthorizedSharesAdjustment>> = true;
const publicStockClassIsExact: Assert<IsExactly<PublicStockClassData, OcfStockClassAuthorizedSharesAdjustment>> = true;
const publicStockPlanIsExact: Assert<IsExactly<PublicStockPlanData, OcfStockPlanPoolAdjustment>> = true;

const issuerDamlIsExact: Assert<
  IsExactly<DamlIssuerAuthorizedSharesAdjustmentData, DamlDataTypeFor<'issuerAuthorizedSharesAdjustment'>>
> = true;
const stockClassDamlIsExact: Assert<
  IsExactly<DamlStockClassAuthorizedSharesAdjustmentData, DamlDataTypeFor<'stockClassAuthorizedSharesAdjustment'>>
> = true;
const stockPlanDamlIsExact: Assert<
  IsExactly<DamlStockPlanPoolAdjustmentData, DamlDataTypeFor<'stockPlanPoolAdjustment'>>
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
const issuerByObjectTypeIsExact: Assert<IsExactly<IssuerByObjectTypeData, OcfIssuerAuthorizedSharesAdjustment>> = true;
const stockClassByObjectTypeIsExact: Assert<
  IsExactly<StockClassByObjectTypeData, OcfStockClassAuthorizedSharesAdjustment>
> = true;
const stockPlanByObjectTypeIsExact: Assert<IsExactly<StockPlanByObjectTypeData, OcfStockPlanPoolAdjustment>> = true;

// @ts-expect-error issuer adjustment cannot be used as a stock-class adjustment
const wrongStockClass: OcfStockClassAuthorizedSharesAdjustment = issuerResult.event;
// @ts-expect-error stock-class adjustment cannot be used as a stock-plan pool adjustment
const wrongStockPlan: OcfStockPlanPoolAdjustment = stockClassResult.event;
// @ts-expect-error stock-plan pool adjustment cannot be used as an issuer adjustment
const wrongIssuer: OcfIssuerAuthorizedSharesAdjustment = stockPlanResult.event;
// @ts-expect-error root OcpClient issuer adjustment data cannot be used as a stock-class adjustment
const wrongPublicStockClass: OcfStockClassAuthorizedSharesAdjustment = publicIssuerData;
// @ts-expect-error root OcpClient stock-class adjustment data cannot be used as a stock-plan adjustment
const wrongPublicStockPlan: OcfStockPlanPoolAdjustment = publicStockClassData;
// @ts-expect-error root OcpClient stock-plan adjustment data cannot be used as an issuer adjustment
const wrongPublicIssuer: OcfIssuerAuthorizedSharesAdjustment = publicStockPlanData;

void issuerEventIsExact;
void stockClassEventIsExact;
void stockPlanEventIsExact;
void issuerEventIsNotAny;
void stockClassEventIsNotAny;
void stockPlanEventIsNotAny;
void publicIssuerIsExact;
void publicStockClassIsExact;
void publicStockPlanIsExact;
void issuerDamlIsExact;
void stockClassDamlIsExact;
void stockPlanDamlIsExact;
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
