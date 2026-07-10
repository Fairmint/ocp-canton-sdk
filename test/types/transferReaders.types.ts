/** Compile-time contracts for exact transfer-reader result families. */

import type { GetConvertibleTransferAsOcfResult } from '../../src/functions/OpenCapTable/convertibleTransfer/getConvertibleTransferAsOcf';
import type { GetEquityCompensationTransferAsOcfResult } from '../../src/functions/OpenCapTable/equityCompensationTransfer/getEquityCompensationTransferAsOcf';
import type { GetStockTransferAsOcfResult } from '../../src/functions/OpenCapTable/stockTransfer/getStockTransferAsOcf';
import type { GetWarrantTransferAsOcfResult } from '../../src/functions/OpenCapTable/warrantTransfer/getWarrantTransferAsOcf';
import type {
  OcfConvertibleTransfer,
  OcfEquityCompensationTransfer,
  OcfStockTransfer,
  OcfWarrantTransfer,
} from '../../src/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type StockEvent = GetStockTransferAsOcfResult['event'];
type ConvertibleEvent = GetConvertibleTransferAsOcfResult['event'];
type EquityCompensationEvent = GetEquityCompensationTransferAsOcfResult['event'];
type WarrantEvent = GetWarrantTransferAsOcfResult['event'];

const stockIsExact: Assert<IsExactly<StockEvent, OcfStockTransfer>> = true;
const convertibleIsExact: Assert<IsExactly<ConvertibleEvent, OcfConvertibleTransfer>> = true;
const equityCompensationIsExact: Assert<IsExactly<EquityCompensationEvent, OcfEquityCompensationTransfer>> = true;
const warrantIsExact: Assert<IsExactly<WarrantEvent, OcfWarrantTransfer>> = true;
const stockIsNotAny: Assert<IsExactly<IsAny<StockEvent>, false>> = true;
const convertibleIsNotAny: Assert<IsExactly<IsAny<ConvertibleEvent>, false>> = true;
const equityCompensationIsNotAny: Assert<IsExactly<IsAny<EquityCompensationEvent>, false>> = true;
const warrantIsNotAny: Assert<IsExactly<IsAny<WarrantEvent>, false>> = true;

declare const stockResult: GetStockTransferAsOcfResult;
declare const convertibleResult: GetConvertibleTransferAsOcfResult;
declare const equityCompensationResult: GetEquityCompensationTransferAsOcfResult;
declare const warrantResult: GetWarrantTransferAsOcfResult;

// @ts-expect-error stock transfer cannot be used as warrant transfer
const wrongWarrant: OcfWarrantTransfer = stockResult.event;
// @ts-expect-error convertible transfer cannot be used as stock transfer
const wrongStock: OcfStockTransfer = convertibleResult.event;
// @ts-expect-error equity-compensation transfer cannot be used as convertible transfer
const wrongConvertible: OcfConvertibleTransfer = equityCompensationResult.event;
// @ts-expect-error warrant transfer cannot be used as equity-compensation transfer
const wrongEquityCompensation: OcfEquityCompensationTransfer = warrantResult.event;

void stockIsExact;
void convertibleIsExact;
void equityCompensationIsExact;
void warrantIsExact;
void stockIsNotAny;
void convertibleIsNotAny;
void equityCompensationIsNotAny;
void warrantIsNotAny;
void wrongWarrant;
void wrongStock;
void wrongConvertible;
void wrongEquityCompensation;
