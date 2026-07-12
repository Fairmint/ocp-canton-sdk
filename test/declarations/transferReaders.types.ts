/** Built-declaration contracts for exact transfer-reader result families. */

import type {
  OcfConvertibleTransfer,
  OcfConvertibleTransferOutput,
  OcfEquityCompensationTransfer,
  OcfEquityCompensationTransferOutput,
  OcfStockTransfer,
  OcfStockTransferOutput,
  OcfWarrantTransfer,
  OcfWarrantTransferOutput,
  OcpClient,
} from '../../dist';
import type { GetConvertibleTransferAsOcfResult } from '../../dist/functions/OpenCapTable/convertibleTransfer/getConvertibleTransferAsOcf';
import type { GetEquityCompensationTransferAsOcfResult } from '../../dist/functions/OpenCapTable/equityCompensationTransfer/getEquityCompensationTransferAsOcf';
import type { GetStockTransferAsOcfResult } from '../../dist/functions/OpenCapTable/stockTransfer/getStockTransferAsOcf';
import type { GetWarrantTransferAsOcfResult } from '../../dist/functions/OpenCapTable/warrantTransfer/getWarrantTransferAsOcf';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type StockEvent = GetStockTransferAsOcfResult['event'];
type ConvertibleEvent = GetConvertibleTransferAsOcfResult['event'];
type EquityCompensationEvent = GetEquityCompensationTransferAsOcfResult['event'];
type WarrantEvent = GetWarrantTransferAsOcfResult['event'];
type PublicOpenCapTable = OcpClient['OpenCapTable'];
type PublicStockData = Awaited<ReturnType<PublicOpenCapTable['stockTransfer']['get']>>['data'];
type PublicConvertibleData = Awaited<ReturnType<PublicOpenCapTable['convertibleTransfer']['get']>>['data'];
type PublicEquityCompensationData = Awaited<
  ReturnType<PublicOpenCapTable['equityCompensationTransfer']['get']>
>['data'];
type PublicWarrantData = Awaited<ReturnType<PublicOpenCapTable['warrantTransfer']['get']>>['data'];

const stockIsExact: Assert<IsExactly<StockEvent, OcfStockTransferOutput>> = true;
const convertibleIsExact: Assert<IsExactly<ConvertibleEvent, OcfConvertibleTransferOutput>> = true;
const equityCompensationIsExact: Assert<IsExactly<EquityCompensationEvent, OcfEquityCompensationTransferOutput>> = true;
const warrantIsExact: Assert<IsExactly<WarrantEvent, OcfWarrantTransferOutput>> = true;
const stockIsNotAny: Assert<IsExactly<IsAny<StockEvent>, false>> = true;
const convertibleIsNotAny: Assert<IsExactly<IsAny<ConvertibleEvent>, false>> = true;
const equityCompensationIsNotAny: Assert<IsExactly<IsAny<EquityCompensationEvent>, false>> = true;
const warrantIsNotAny: Assert<IsExactly<IsAny<WarrantEvent>, false>> = true;
const publicStockIsExact: Assert<IsExactly<PublicStockData, OcfStockTransferOutput>> = true;
const publicConvertibleIsExact: Assert<IsExactly<PublicConvertibleData, OcfConvertibleTransferOutput>> = true;
const publicEquityCompensationIsExact: Assert<
  IsExactly<PublicEquityCompensationData, OcfEquityCompensationTransferOutput>
> = true;
const publicWarrantIsExact: Assert<IsExactly<PublicWarrantData, OcfWarrantTransferOutput>> = true;

declare const stockResult: GetStockTransferAsOcfResult;
declare const convertibleResult: GetConvertibleTransferAsOcfResult;
declare const equityCompensationResult: GetEquityCompensationTransferAsOcfResult;
declare const warrantResult: GetWarrantTransferAsOcfResult;

// @ts-expect-error built stock transfer cannot be used as warrant transfer
const wrongWarrant: OcfWarrantTransfer = stockResult.event;
// @ts-expect-error built convertible transfer cannot be used as stock transfer
const wrongStock: OcfStockTransfer = convertibleResult.event;
// @ts-expect-error built equity-compensation transfer cannot be used as convertible transfer
const wrongConvertible: OcfConvertibleTransfer = equityCompensationResult.event;
// @ts-expect-error built warrant transfer cannot be used as equity-compensation transfer
const wrongEquityCompensation: OcfEquityCompensationTransfer = warrantResult.event;
// @ts-expect-error built transfer reader event properties are immutable
stockResult.event.id = 'mutated';
// @ts-expect-error built transfer reader result IDs are immutable
stockResult.event.resulting_security_ids.push('mutated');
// @ts-expect-error built transfer reader Monetary records are immutable
convertibleResult.event.amount.amount = '0';
declare const publicStockData: PublicStockData;
// @ts-expect-error root OcpClient stock transfer data cannot be used as convertible transfer data
const wrongPublicConvertible: OcfConvertibleTransfer = publicStockData;

void stockIsExact;
void convertibleIsExact;
void equityCompensationIsExact;
void warrantIsExact;
void stockIsNotAny;
void convertibleIsNotAny;
void equityCompensationIsNotAny;
void warrantIsNotAny;
void publicStockIsExact;
void publicConvertibleIsExact;
void publicEquityCompensationIsExact;
void publicWarrantIsExact;
void wrongWarrant;
void wrongStock;
void wrongConvertible;
void wrongEquityCompensation;
void wrongPublicConvertible;
