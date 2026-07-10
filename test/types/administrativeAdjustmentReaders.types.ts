/** Compile-time contracts for administrative adjustment readers and converter inputs. */

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
import type {
  OcfIssuerAuthorizedSharesAdjustment,
  OcfStockClassAuthorizedSharesAdjustment,
  OcfStockPlanPoolAdjustment,
} from '../../src/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type IssuerEvent = GetIssuerAuthorizedSharesAdjustmentAsOcfResult['event'];
type StockClassEvent = GetStockClassAuthorizedSharesAdjustmentAsOcfResult['event'];
type StockPlanEvent = GetStockPlanPoolAdjustmentAsOcfResult['event'];

const issuerEventIsExact: Assert<IsExactly<IssuerEvent, OcfIssuerAuthorizedSharesAdjustment>> = true;
const stockClassEventIsExact: Assert<IsExactly<StockClassEvent, OcfStockClassAuthorizedSharesAdjustment>> = true;
const stockPlanEventIsExact: Assert<IsExactly<StockPlanEvent, OcfStockPlanPoolAdjustment>> = true;
const issuerEventIsNotAny: Assert<IsExactly<IsAny<IssuerEvent>, false>> = true;
const stockClassEventIsNotAny: Assert<IsExactly<IsAny<StockClassEvent>, false>> = true;
const stockPlanEventIsNotAny: Assert<IsExactly<IsAny<StockPlanEvent>, false>> = true;

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

// @ts-expect-error issuer adjustment cannot be used as a stock-class adjustment
const wrongStockClass: OcfStockClassAuthorizedSharesAdjustment = issuerResult.event;
// @ts-expect-error stock-class adjustment cannot be used as a stock-plan pool adjustment
const wrongStockPlan: OcfStockPlanPoolAdjustment = stockClassResult.event;
// @ts-expect-error stock-plan pool adjustment cannot be used as an issuer adjustment
const wrongIssuer: OcfIssuerAuthorizedSharesAdjustment = stockPlanResult.event;

void issuerEventIsExact;
void stockClassEventIsExact;
void stockPlanEventIsExact;
void issuerEventIsNotAny;
void stockClassEventIsNotAny;
void stockPlanEventIsNotAny;
void issuerDamlIsExact;
void stockClassDamlIsExact;
void stockPlanDamlIsExact;
void wrongStockClass;
void wrongStockPlan;
void wrongIssuer;
