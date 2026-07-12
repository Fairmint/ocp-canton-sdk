/** Compile-time contracts for exact acceptance-reader result families. */

import type { GetEntityAsOcfResult } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import type { GetConvertibleAcceptanceAsOcfResult } from '../../src/functions/OpenCapTable/convertibleAcceptance/getConvertibleAcceptanceAsOcf';
import type { GetEquityCompensationAcceptanceAsOcfResult } from '../../src/functions/OpenCapTable/equityCompensationAcceptance/getEquityCompensationAcceptanceAsOcf';
import type { GetStockAcceptanceAsOcfResult } from '../../src/functions/OpenCapTable/stockAcceptance/getStockAcceptanceAsOcf';
import type { GetWarrantAcceptanceAsOcfResult } from '../../src/functions/OpenCapTable/warrantAcceptance/getWarrantAcceptanceAsOcf';
import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../src/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type StockEvent = GetStockAcceptanceAsOcfResult['event'];
type ConvertibleEvent = GetConvertibleAcceptanceAsOcfResult['event'];
type EquityCompensationEvent = GetEquityCompensationAcceptanceAsOcfResult['event'];
type WarrantEvent = GetWarrantAcceptanceAsOcfResult['event'];
type GenericStockEvent = GetEntityAsOcfResult<'stockAcceptance'>['data'];
type GenericConvertibleEvent = GetEntityAsOcfResult<'convertibleAcceptance'>['data'];
type GenericEquityCompensationEvent = GetEntityAsOcfResult<'equityCompensationAcceptance'>['data'];
type GenericWarrantEvent = GetEntityAsOcfResult<'warrantAcceptance'>['data'];

const stockIsExact: Assert<IsExactly<StockEvent, OcfStockAcceptance>> = true;
const convertibleIsExact: Assert<IsExactly<ConvertibleEvent, OcfConvertibleAcceptance>> = true;
const equityCompensationIsExact: Assert<IsExactly<EquityCompensationEvent, OcfEquityCompensationAcceptance>> = true;
const warrantIsExact: Assert<IsExactly<WarrantEvent, OcfWarrantAcceptance>> = true;
const genericStockIsExact: Assert<IsExactly<GenericStockEvent, OcfStockAcceptance>> = true;
const genericConvertibleIsExact: Assert<IsExactly<GenericConvertibleEvent, OcfConvertibleAcceptance>> = true;
const genericEquityCompensationIsExact: Assert<
  IsExactly<GenericEquityCompensationEvent, OcfEquityCompensationAcceptance>
> = true;
const genericWarrantIsExact: Assert<IsExactly<GenericWarrantEvent, OcfWarrantAcceptance>> = true;

const stockIsNotAny: Assert<IsExactly<IsAny<StockEvent>, false>> = true;
const convertibleIsNotAny: Assert<IsExactly<IsAny<ConvertibleEvent>, false>> = true;
const equityCompensationIsNotAny: Assert<IsExactly<IsAny<EquityCompensationEvent>, false>> = true;
const warrantIsNotAny: Assert<IsExactly<IsAny<WarrantEvent>, false>> = true;

declare const stockResult: GetStockAcceptanceAsOcfResult;
declare const convertibleResult: GetConvertibleAcceptanceAsOcfResult;
declare const equityCompensationResult: GetEquityCompensationAcceptanceAsOcfResult;
declare const warrantResult: GetWarrantAcceptanceAsOcfResult;

// @ts-expect-error stock acceptance cannot be used as warrant acceptance
const wrongWarrant: OcfWarrantAcceptance = stockResult.event;
// @ts-expect-error convertible acceptance cannot be used as stock acceptance
const wrongStock: OcfStockAcceptance = convertibleResult.event;
// @ts-expect-error equity-compensation acceptance cannot be used as convertible acceptance
const wrongConvertible: OcfConvertibleAcceptance = equityCompensationResult.event;
// @ts-expect-error warrant acceptance cannot be used as equity-compensation acceptance
const wrongEquityCompensation: OcfEquityCompensationAcceptance = warrantResult.event;

void stockIsExact;
void convertibleIsExact;
void equityCompensationIsExact;
void warrantIsExact;
void genericStockIsExact;
void genericConvertibleIsExact;
void genericEquityCompensationIsExact;
void genericWarrantIsExact;
void stockIsNotAny;
void convertibleIsNotAny;
void equityCompensationIsNotAny;
void warrantIsNotAny;
void wrongWarrant;
void wrongStock;
void wrongConvertible;
void wrongEquityCompensation;
