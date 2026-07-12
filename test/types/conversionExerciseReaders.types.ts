/** Compile-time contracts for conversion and exercise readers and converters. */

import type { DamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type {
  DamlConvertibleConversionData,
  damlConvertibleConversionToNative,
} from '../../src/functions/OpenCapTable/convertibleConversion/damlToOcf';
import type { GetConvertibleConversionAsOcfResult } from '../../src/functions/OpenCapTable/convertibleConversion/getConvertibleConversionAsOcf';
import type {
  DamlEquityCompensationExerciseData,
  damlEquityCompensationExerciseDataToNative,
  GetEquityCompensationExerciseAsOcfResult,
} from '../../src/functions/OpenCapTable/equityCompensationExercise/getEquityCompensationExerciseAsOcf';
import type {
  DamlStockConversionData,
  damlStockConversionToNative,
} from '../../src/functions/OpenCapTable/stockConversion/damlToOcf';
import type { GetStockConversionAsOcfResult } from '../../src/functions/OpenCapTable/stockConversion/getStockConversionAsOcf';
import type {
  DamlWarrantExerciseData,
  damlWarrantExerciseToNative,
} from '../../src/functions/OpenCapTable/warrantExercise/damlToOcf';
import type { GetWarrantExerciseAsOcfResult } from '../../src/functions/OpenCapTable/warrantExercise/getWarrantExerciseAsOcf';
import type { DeepReadonly } from '../../src/types/common';
import type {
  OcfConvertibleConversion,
  OcfEquityCompensationExercise,
  OcfStockConversion,
  OcfWarrantExercise,
} from '../../src/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type ReadEvent<T> = DeepReadonly<T>;

type ConvertibleResult = GetConvertibleConversionAsOcfResult;
type StockResult = GetStockConversionAsOcfResult;
type EquityCompensationResult = GetEquityCompensationExerciseAsOcfResult;
type WarrantResult = GetWarrantExerciseAsOcfResult;
type ConvertibleEvent = ConvertibleResult['event'];
type StockEvent = StockResult['event'];
type EquityCompensationEvent = EquityCompensationResult['event'];
type WarrantEvent = WarrantResult['event'];
type ConvertibleInput = Parameters<typeof damlConvertibleConversionToNative>[0];
type StockInput = Parameters<typeof damlStockConversionToNative>[0];
type EquityCompensationInput = Parameters<typeof damlEquityCompensationExerciseDataToNative>[0];
type WarrantInput = Parameters<typeof damlWarrantExerciseToNative>[0];

const convertibleResultIsExact: Assert<
  IsExactly<ConvertibleResult, { readonly event: ReadEvent<OcfConvertibleConversion>; readonly contractId: string }>
> = true;
const stockResultIsExact: Assert<
  IsExactly<StockResult, { readonly event: ReadEvent<OcfStockConversion>; readonly contractId: string }>
> = true;
const equityCompensationResultIsExact: Assert<
  IsExactly<
    EquityCompensationResult,
    { readonly event: ReadEvent<OcfEquityCompensationExercise>; readonly contractId: string }
  >
> = true;
const warrantResultIsExact: Assert<
  IsExactly<WarrantResult, { readonly event: ReadEvent<OcfWarrantExercise>; readonly contractId: string }>
> = true;

const convertibleEventIsExact: Assert<IsExactly<ConvertibleEvent, ReadEvent<OcfConvertibleConversion>>> = true;
const stockEventIsExact: Assert<IsExactly<StockEvent, ReadEvent<OcfStockConversion>>> = true;
const equityCompensationEventIsExact: Assert<
  IsExactly<EquityCompensationEvent, ReadEvent<OcfEquityCompensationExercise>>
> = true;
const warrantEventIsExact: Assert<IsExactly<WarrantEvent, ReadEvent<OcfWarrantExercise>>> = true;
const convertibleResultIsNotAny: Assert<IsExactly<IsAny<ConvertibleResult>, false>> = true;
const stockResultIsNotAny: Assert<IsExactly<IsAny<StockResult>, false>> = true;
const equityCompensationResultIsNotAny: Assert<IsExactly<IsAny<EquityCompensationResult>, false>> = true;
const warrantResultIsNotAny: Assert<IsExactly<IsAny<WarrantResult>, false>> = true;
const convertibleEventIsNotAny: Assert<IsExactly<IsAny<ConvertibleEvent>, false>> = true;
const stockEventIsNotAny: Assert<IsExactly<IsAny<StockEvent>, false>> = true;
const equityCompensationEventIsNotAny: Assert<IsExactly<IsAny<EquityCompensationEvent>, false>> = true;
const warrantEventIsNotAny: Assert<IsExactly<IsAny<WarrantEvent>, false>> = true;

const convertibleInputIsExact: Assert<IsExactly<ConvertibleInput, DamlConvertibleConversionData>> = true;
const stockInputIsExact: Assert<IsExactly<StockInput, DamlStockConversionData>> = true;
const equityCompensationInputIsExact: Assert<IsExactly<EquityCompensationInput, DamlEquityCompensationExerciseData>> =
  true;
const warrantInputIsExact: Assert<IsExactly<WarrantInput, DamlWarrantExerciseData>> = true;
const convertibleDamlIsExact: Assert<
  IsExactly<DamlConvertibleConversionData, DamlDataTypeFor<'convertibleConversion'>>
> = true;
const stockDamlIsExact: Assert<IsExactly<DamlStockConversionData, DamlDataTypeFor<'stockConversion'>>> = true;
const equityCompensationDamlIsExact: Assert<
  IsExactly<DamlEquityCompensationExerciseData, DamlDataTypeFor<'equityCompensationExercise'>>
> = true;
const warrantDamlIsExact: Assert<IsExactly<DamlWarrantExerciseData, DamlDataTypeFor<'warrantExercise'>>> = true;
const convertibleInputIsNotAny: Assert<IsExactly<IsAny<ConvertibleInput>, false>> = true;
const stockInputIsNotAny: Assert<IsExactly<IsAny<StockInput>, false>> = true;
const equityCompensationInputIsNotAny: Assert<IsExactly<IsAny<EquityCompensationInput>, false>> = true;
const warrantInputIsNotAny: Assert<IsExactly<IsAny<WarrantInput>, false>> = true;

declare const convertibleResult: ConvertibleResult;
declare const stockResult: StockResult;
declare const equityCompensationResult: EquityCompensationResult;
declare const warrantResult: WarrantResult;
declare const convertibleDaml: DamlConvertibleConversionData;
declare const stockDaml: DamlStockConversionData;
declare const equityCompensationDaml: DamlEquityCompensationExerciseData;
declare const warrantDaml: DamlWarrantExerciseData;

// @ts-expect-error convertible results cannot be used as stock conversions
const wrongStockEvent: OcfStockConversion = convertibleResult.event;
// @ts-expect-error stock results cannot be used as convertible conversions
const wrongConvertibleEvent: OcfConvertibleConversion = stockResult.event;
// @ts-expect-error equity-compensation results cannot be used as warrant exercises
const wrongWarrantEvent: OcfWarrantExercise = equityCompensationResult.event;
// @ts-expect-error warrant results cannot be used as equity-compensation exercises
const wrongEquityCompensationEvent: OcfEquityCompensationExercise = warrantResult.event;
// @ts-expect-error convertible DAML cannot be passed to the stock converter
const wrongStockDaml: StockInput = convertibleDaml;
// @ts-expect-error stock DAML cannot be passed to the convertible converter
const wrongConvertibleDaml: ConvertibleInput = stockDaml;
// @ts-expect-error equity-compensation DAML cannot be passed to the warrant converter
const wrongWarrantDaml: WarrantInput = equityCompensationDaml;
// @ts-expect-error warrant DAML cannot be passed to the equity-compensation converter
const wrongEquityCompensationDaml: EquityCompensationInput = warrantDaml;

void convertibleResultIsExact;
void stockResultIsExact;
void equityCompensationResultIsExact;
void warrantResultIsExact;
void convertibleEventIsExact;
void stockEventIsExact;
void equityCompensationEventIsExact;
void warrantEventIsExact;
void convertibleResultIsNotAny;
void stockResultIsNotAny;
void equityCompensationResultIsNotAny;
void warrantResultIsNotAny;
void convertibleEventIsNotAny;
void stockEventIsNotAny;
void equityCompensationEventIsNotAny;
void warrantEventIsNotAny;
void convertibleInputIsExact;
void stockInputIsExact;
void equityCompensationInputIsExact;
void warrantInputIsExact;
void convertibleDamlIsExact;
void stockDamlIsExact;
void equityCompensationDamlIsExact;
void warrantDamlIsExact;
void convertibleInputIsNotAny;
void stockInputIsNotAny;
void equityCompensationInputIsNotAny;
void warrantInputIsNotAny;
void wrongStockEvent;
void wrongConvertibleEvent;
void wrongWarrantEvent;
void wrongEquityCompensationEvent;
void wrongStockDaml;
void wrongConvertibleDaml;
void wrongWarrantDaml;
void wrongEquityCompensationDaml;
