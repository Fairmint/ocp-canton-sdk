/** Compile-time contracts for exact cancellation-reader result families. */

import type { convertibleCancellationDataToDaml } from '../../src/functions/OpenCapTable/convertibleCancellation/createConvertibleCancellation';
import type { DamlConvertibleCancellationData } from '../../src/functions/OpenCapTable/convertibleCancellation/damlToOcf';
import type { GetConvertibleCancellationAsOcfResult } from '../../src/functions/OpenCapTable/convertibleCancellation/getConvertibleCancellationAsOcf';
import type { equityCompensationCancellationDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationCancellation/createEquityCompensationCancellation';
import type { DamlEquityCompensationCancellationData } from '../../src/functions/OpenCapTable/equityCompensationCancellation/damlToOcf';
import type { GetEquityCompensationCancellationAsOcfResult } from '../../src/functions/OpenCapTable/equityCompensationCancellation/getEquityCompensationCancellationAsOcf';
import type { stockCancellationDataToDaml } from '../../src/functions/OpenCapTable/stockCancellation/createStockCancellation';
import type { DamlStockCancellationData } from '../../src/functions/OpenCapTable/stockCancellation/damlToOcf';
import type { GetStockCancellationAsOcfResult } from '../../src/functions/OpenCapTable/stockCancellation/getStockCancellationAsOcf';
import type { warrantCancellationDataToDaml } from '../../src/functions/OpenCapTable/warrantCancellation/createWarrantCancellation';
import type { DamlWarrantCancellationData } from '../../src/functions/OpenCapTable/warrantCancellation/damlToOcf';
import type { GetWarrantCancellationAsOcfResult } from '../../src/functions/OpenCapTable/warrantCancellation/getWarrantCancellationAsOcf';
import type {
  PkgConvertibleCancellationOcfData,
  PkgEquityCompensationCancellationOcfData,
  PkgStockCancellationOcfData,
  PkgWarrantCancellationOcfData,
} from '../../src/types/daml';
import type {
  OcfConvertibleCancellation,
  OcfEquityCompensationCancellation,
  OcfStockCancellation,
  OcfWarrantCancellation,
} from '../../src/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type StockEvent = GetStockCancellationAsOcfResult['event'];
type ConvertibleEvent = GetConvertibleCancellationAsOcfResult['event'];
type EquityCompensationEvent = GetEquityCompensationCancellationAsOcfResult['event'];
type WarrantEvent = GetWarrantCancellationAsOcfResult['event'];

const stockIsExact: Assert<IsExactly<StockEvent, OcfStockCancellation>> = true;
const convertibleIsExact: Assert<IsExactly<ConvertibleEvent, OcfConvertibleCancellation>> = true;
const equityCompensationIsExact: Assert<IsExactly<EquityCompensationEvent, OcfEquityCompensationCancellation>> = true;
const warrantIsExact: Assert<IsExactly<WarrantEvent, OcfWarrantCancellation>> = true;
const stockIsNotAny: Assert<IsExactly<IsAny<StockEvent>, false>> = true;
const convertibleIsNotAny: Assert<IsExactly<IsAny<ConvertibleEvent>, false>> = true;
const equityCompensationIsNotAny: Assert<IsExactly<IsAny<EquityCompensationEvent>, false>> = true;
const warrantIsNotAny: Assert<IsExactly<IsAny<WarrantEvent>, false>> = true;
const stockDamlInputIsGenerated: Assert<IsExactly<DamlStockCancellationData, PkgStockCancellationOcfData>> = true;
const convertibleDamlInputIsGenerated: Assert<
  IsExactly<DamlConvertibleCancellationData, PkgConvertibleCancellationOcfData>
> = true;
const equityDamlInputIsGenerated: Assert<
  IsExactly<DamlEquityCompensationCancellationData, PkgEquityCompensationCancellationOcfData>
> = true;
const warrantDamlInputIsGenerated: Assert<IsExactly<DamlWarrantCancellationData, PkgWarrantCancellationOcfData>> = true;
const stockWriterIsGenerated: Assert<
  IsExactly<ReturnType<typeof stockCancellationDataToDaml>, PkgStockCancellationOcfData>
> = true;
const convertibleWriterIsGenerated: Assert<
  IsExactly<ReturnType<typeof convertibleCancellationDataToDaml>, PkgConvertibleCancellationOcfData>
> = true;
const equityWriterIsGenerated: Assert<
  IsExactly<ReturnType<typeof equityCompensationCancellationDataToDaml>, PkgEquityCompensationCancellationOcfData>
> = true;
const warrantWriterIsGenerated: Assert<
  IsExactly<ReturnType<typeof warrantCancellationDataToDaml>, PkgWarrantCancellationOcfData>
> = true;

declare const stockResult: GetStockCancellationAsOcfResult;
declare const convertibleResult: GetConvertibleCancellationAsOcfResult;
declare const equityCompensationResult: GetEquityCompensationCancellationAsOcfResult;
declare const warrantResult: GetWarrantCancellationAsOcfResult;

// @ts-expect-error exact reader results are immutable at their top-level boundary
stockResult.contractId = 'different-contract';
// @ts-expect-error exact reader results cannot be reassigned to a different event family
convertibleResult.event = stockResult.event;

// @ts-expect-error stock cancellation cannot be used as warrant cancellation
const wrongWarrant: OcfWarrantCancellation = stockResult.event;
// @ts-expect-error convertible cancellation cannot be used as stock cancellation
const wrongStock: OcfStockCancellation = convertibleResult.event;
// @ts-expect-error equity-compensation cancellation cannot be used as convertible cancellation
const wrongConvertible: OcfConvertibleCancellation = equityCompensationResult.event;
// @ts-expect-error warrant cancellation cannot be used as equity-compensation cancellation
const wrongEquityCompensation: OcfEquityCompensationCancellation = warrantResult.event;

void stockIsExact;
void convertibleIsExact;
void equityCompensationIsExact;
void warrantIsExact;
void stockIsNotAny;
void convertibleIsNotAny;
void equityCompensationIsNotAny;
void warrantIsNotAny;
void stockDamlInputIsGenerated;
void convertibleDamlInputIsGenerated;
void equityDamlInputIsGenerated;
void warrantDamlInputIsGenerated;
void stockWriterIsGenerated;
void convertibleWriterIsGenerated;
void equityWriterIsGenerated;
void warrantWriterIsGenerated;
void wrongWarrant;
void wrongStock;
void wrongConvertible;
void wrongEquityCompensation;
