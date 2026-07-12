/** Built-declaration contracts for exact acceptance-reader result families. */

import type { GetEntityAsOcfResult } from '../../dist/functions/OpenCapTable/capTable/damlToOcf';
import type { GetConvertibleAcceptanceAsOcfResult } from '../../dist/functions/OpenCapTable/convertibleAcceptance/getConvertibleAcceptanceAsOcf';
import type { GetEquityCompensationAcceptanceAsOcfResult } from '../../dist/functions/OpenCapTable/equityCompensationAcceptance/getEquityCompensationAcceptanceAsOcf';
import type { GetStockAcceptanceAsOcfResult } from '../../dist/functions/OpenCapTable/stockAcceptance/getStockAcceptanceAsOcf';
import type { GetWarrantAcceptanceAsOcfResult } from '../../dist/functions/OpenCapTable/warrantAcceptance/getWarrantAcceptanceAsOcf';
import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../dist/types/native';
import type { Assert, ContainsAny, IsExactly } from '../typeContracts/typeAssertions';

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

const stockIsNotAny: Assert<IsExactly<ContainsAny<StockEvent>, false>> = true;
const convertibleIsNotAny: Assert<IsExactly<ContainsAny<ConvertibleEvent>, false>> = true;
const equityCompensationIsNotAny: Assert<IsExactly<ContainsAny<EquityCompensationEvent>, false>> = true;
const warrantIsNotAny: Assert<IsExactly<ContainsAny<WarrantEvent>, false>> = true;
const genericStockIsNotAny: Assert<IsExactly<ContainsAny<GenericStockEvent>, false>> = true;
const genericConvertibleIsNotAny: Assert<IsExactly<ContainsAny<GenericConvertibleEvent>, false>> = true;
const genericEquityCompensationIsNotAny: Assert<IsExactly<ContainsAny<GenericEquityCompensationEvent>, false>> = true;
const genericWarrantIsNotAny: Assert<IsExactly<ContainsAny<GenericWarrantEvent>, false>> = true;

declare const stockResult: GetStockAcceptanceAsOcfResult;
declare const convertibleResult: GetConvertibleAcceptanceAsOcfResult;
declare const equityCompensationResult: GetEquityCompensationAcceptanceAsOcfResult;
declare const warrantResult: GetWarrantAcceptanceAsOcfResult;

// @ts-expect-error built stock acceptance cannot be used as warrant acceptance
const wrongWarrant: OcfWarrantAcceptance = stockResult.event;
// @ts-expect-error built convertible acceptance cannot be used as stock acceptance
const wrongStock: OcfStockAcceptance = convertibleResult.event;
// @ts-expect-error built equity-compensation acceptance cannot be used as convertible acceptance
const wrongConvertible: OcfConvertibleAcceptance = equityCompensationResult.event;
// @ts-expect-error built warrant acceptance cannot be used as equity-compensation acceptance
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
void genericStockIsNotAny;
void genericConvertibleIsNotAny;
void genericEquityCompensationIsNotAny;
void genericWarrantIsNotAny;
void wrongWarrant;
void wrongStock;
void wrongConvertible;
void wrongEquityCompensation;
