/** Built-declaration contracts for stock corporate-action readers and converters. */

import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import type {
  DamlStockClassConversionRatioAdjustmentData,
  damlStockClassConversionRatioAdjustmentToNative,
} from '../../dist/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import type { GetStockClassConversionRatioAdjustmentAsOcfResult } from '../../dist/functions/OpenCapTable/stockClassConversionRatioAdjustment/getStockClassConversionRatioAdjustmentAsOcf';
import type {
  DamlStockClassSplitData,
  damlStockClassSplitToNative,
} from '../../dist/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';
import type { GetStockClassSplitAsOcfResult } from '../../dist/functions/OpenCapTable/stockClassSplit/getStockClassSplitAsOcf';
import type {
  DamlStockConsolidationData,
  damlStockConsolidationToNative,
} from '../../dist/functions/OpenCapTable/stockConsolidation/damlToStockConsolidation';
import type { GetStockConsolidationAsOcfResult } from '../../dist/functions/OpenCapTable/stockConsolidation/getStockConsolidationAsOcf';
import type {
  DamlStockReissuanceData,
  damlStockReissuanceToNative,
} from '../../dist/functions/OpenCapTable/stockReissuance/damlToStockReissuance';
import type { GetStockReissuanceAsOcfResult } from '../../dist/functions/OpenCapTable/stockReissuance/getStockReissuanceAsOcf';
import type {
  DamlStockRepurchaseData,
  damlStockRepurchaseToNative,
} from '../../dist/functions/OpenCapTable/stockRepurchase/damlToOcf';
import type { GetStockRepurchaseAsOcfResult } from '../../dist/functions/OpenCapTable/stockRepurchase/getStockRepurchaseAsOcf';
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

type ConversionRatioEvent = GetStockClassConversionRatioAdjustmentAsOcfResult['event'];
type SplitEvent = GetStockClassSplitAsOcfResult['event'];
type ConsolidationEvent = GetStockConsolidationAsOcfResult['event'];
type ReissuanceEvent = GetStockReissuanceAsOcfResult['event'];
type RepurchaseEvent = GetStockRepurchaseAsOcfResult['event'];

const conversionRatioEventIsExact: Assert<IsExactly<ConversionRatioEvent, OcfStockClassConversionRatioAdjustment>> =
  true;
const splitEventIsExact: Assert<IsExactly<SplitEvent, OcfStockClassSplit>> = true;
const consolidationEventIsExact: Assert<IsExactly<ConsolidationEvent, OcfStockConsolidation>> = true;
const reissuanceEventIsExact: Assert<IsExactly<ReissuanceEvent, OcfStockReissuance>> = true;
const repurchaseEventIsExact: Assert<IsExactly<RepurchaseEvent, OcfStockRepurchase>> = true;
const conversionRatioResultIsExact: Assert<
  IsExactly<
    GetStockClassConversionRatioAdjustmentAsOcfResult,
    { event: OcfStockClassConversionRatioAdjustment; contractId: string }
  >
> = true;
const splitResultIsExact: Assert<
  IsExactly<GetStockClassSplitAsOcfResult, { event: OcfStockClassSplit; contractId: string }>
> = true;
const consolidationResultIsExact: Assert<
  IsExactly<GetStockConsolidationAsOcfResult, { event: OcfStockConsolidation; contractId: string }>
> = true;
const reissuanceResultIsExact: Assert<
  IsExactly<GetStockReissuanceAsOcfResult, { event: OcfStockReissuance; contractId: string }>
> = true;
const repurchaseResultIsExact: Assert<
  IsExactly<GetStockRepurchaseAsOcfResult, { event: OcfStockRepurchase; contractId: string }>
> = true;

const conversionRatioEventIsNotAny: Assert<IsExactly<IsAny<ConversionRatioEvent>, false>> = true;
const splitEventIsNotAny: Assert<IsExactly<IsAny<SplitEvent>, false>> = true;
const consolidationEventIsNotAny: Assert<IsExactly<IsAny<ConsolidationEvent>, false>> = true;
const reissuanceEventIsNotAny: Assert<IsExactly<IsAny<ReissuanceEvent>, false>> = true;
const repurchaseEventIsNotAny: Assert<IsExactly<IsAny<RepurchaseEvent>, false>> = true;

const conversionRatioDamlIsExact: Assert<
  IsExactly<DamlStockClassConversionRatioAdjustmentData, DamlDataTypeFor<'stockClassConversionRatioAdjustment'>>
> = true;
const splitDamlIsExact: Assert<IsExactly<DamlStockClassSplitData, DamlDataTypeFor<'stockClassSplit'>>> = true;
const consolidationDamlIsExact: Assert<IsExactly<DamlStockConsolidationData, DamlDataTypeFor<'stockConsolidation'>>> =
  true;
const reissuanceDamlIsExact: Assert<IsExactly<DamlStockReissuanceData, DamlDataTypeFor<'stockReissuance'>>> = true;
const repurchaseDamlIsExact: Assert<IsExactly<DamlStockRepurchaseData, DamlDataTypeFor<'stockRepurchase'>>> = true;

const conversionRatioConverterInputIsExact: Assert<
  IsExactly<
    Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0],
    DamlDataTypeFor<'stockClassConversionRatioAdjustment'>
  >
> = true;
const splitConverterInputIsExact: Assert<
  IsExactly<Parameters<typeof damlStockClassSplitToNative>[0], DamlDataTypeFor<'stockClassSplit'>>
> = true;
const consolidationConverterInputIsExact: Assert<
  IsExactly<Parameters<typeof damlStockConsolidationToNative>[0], DamlDataTypeFor<'stockConsolidation'>>
> = true;
const reissuanceConverterInputIsExact: Assert<
  IsExactly<Parameters<typeof damlStockReissuanceToNative>[0], DamlDataTypeFor<'stockReissuance'>>
> = true;
const repurchaseConverterInputIsExact: Assert<
  IsExactly<Parameters<typeof damlStockRepurchaseToNative>[0], DamlDataTypeFor<'stockRepurchase'>>
> = true;
const conversionRatioConverterInputIsNotAny: Assert<
  IsExactly<IsAny<Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0]>, false>
> = true;
const splitConverterInputIsNotAny: Assert<IsExactly<IsAny<Parameters<typeof damlStockClassSplitToNative>[0]>, false>> =
  true;
const consolidationConverterInputIsNotAny: Assert<
  IsExactly<IsAny<Parameters<typeof damlStockConsolidationToNative>[0]>, false>
> = true;
const reissuanceConverterInputIsNotAny: Assert<
  IsExactly<IsAny<Parameters<typeof damlStockReissuanceToNative>[0]>, false>
> = true;
const repurchaseConverterInputIsNotAny: Assert<
  IsExactly<IsAny<Parameters<typeof damlStockRepurchaseToNative>[0]>, false>
> = true;

type ConversionRatioRounding =
  OcfStockClassConversionRatioAdjustment['new_ratio_conversion_mechanism']['rounding_type'];
const roundingUnionIsExact: Assert<IsExactly<ConversionRatioRounding, 'CEILING' | 'FLOOR' | 'NORMAL'>> = true;

declare const conversionRatioResult: GetStockClassConversionRatioAdjustmentAsOcfResult;
declare const splitResult: GetStockClassSplitAsOcfResult;
declare const consolidationResult: GetStockConsolidationAsOcfResult;
declare const reissuanceResult: GetStockReissuanceAsOcfResult;
declare const repurchaseResult: GetStockRepurchaseAsOcfResult;
declare const conversionRatioDaml: DamlStockClassConversionRatioAdjustmentData;
declare const splitDaml: DamlStockClassSplitData;
declare const consolidationDaml: DamlStockConsolidationData;
declare const reissuanceDaml: DamlStockReissuanceData;
declare const repurchaseDaml: DamlStockRepurchaseData;

const firstConsolidatedSecurityId: string = consolidationResult.event.security_ids[0];
const firstReissuedSecurityId: string | undefined = reissuanceResult.event.resulting_security_ids[0];

// @ts-expect-error built conversion-ratio DAML cannot be passed to the split converter
const wrongSplitDamlInput: Parameters<typeof damlStockClassSplitToNative>[0] = conversionRatioDaml;
// @ts-expect-error built split DAML cannot be passed to the consolidation converter
const wrongConsolidationDamlInput: Parameters<typeof damlStockConsolidationToNative>[0] = splitDaml;
// @ts-expect-error built consolidation DAML cannot be passed to the reissuance converter
const wrongReissuanceDamlInput: Parameters<typeof damlStockReissuanceToNative>[0] = consolidationDaml;
// @ts-expect-error built reissuance DAML cannot be passed to the repurchase converter
const wrongRepurchaseDamlInput: Parameters<typeof damlStockRepurchaseToNative>[0] = reissuanceDaml;
// @ts-expect-error built repurchase DAML cannot be passed to the conversion-ratio converter
const wrongConversionRatioDamlInput: Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0] =
  repurchaseDaml;

// @ts-expect-error built conversion-ratio adjustment cannot be used as a split
const wrongSplit: OcfStockClassSplit = conversionRatioResult.event;
// @ts-expect-error built split cannot be used as a consolidation
const wrongConsolidation: OcfStockConsolidation = splitResult.event;
// @ts-expect-error built consolidation cannot be used as a reissuance
const wrongReissuance: OcfStockReissuance = consolidationResult.event;
// @ts-expect-error built reissuance cannot be used as a repurchase
const wrongRepurchase: OcfStockRepurchase = reissuanceResult.event;
// @ts-expect-error built repurchase cannot be used as a conversion-ratio adjustment
const wrongConversionRatio: OcfStockClassConversionRatioAdjustment = repurchaseResult.event;
// @ts-expect-error built canonical rounding is a closed union
const invalidRounding: ConversionRatioRounding = 'BANKERS';

void conversionRatioEventIsExact;
void splitEventIsExact;
void consolidationEventIsExact;
void reissuanceEventIsExact;
void repurchaseEventIsExact;
void conversionRatioResultIsExact;
void splitResultIsExact;
void consolidationResultIsExact;
void reissuanceResultIsExact;
void repurchaseResultIsExact;
void conversionRatioEventIsNotAny;
void splitEventIsNotAny;
void consolidationEventIsNotAny;
void reissuanceEventIsNotAny;
void repurchaseEventIsNotAny;
void conversionRatioDamlIsExact;
void splitDamlIsExact;
void consolidationDamlIsExact;
void reissuanceDamlIsExact;
void repurchaseDamlIsExact;
void conversionRatioConverterInputIsExact;
void splitConverterInputIsExact;
void consolidationConverterInputIsExact;
void reissuanceConverterInputIsExact;
void repurchaseConverterInputIsExact;
void conversionRatioConverterInputIsNotAny;
void splitConverterInputIsNotAny;
void consolidationConverterInputIsNotAny;
void reissuanceConverterInputIsNotAny;
void repurchaseConverterInputIsNotAny;
void roundingUnionIsExact;
void firstConsolidatedSecurityId;
void firstReissuedSecurityId;
void wrongSplitDamlInput;
void wrongConsolidationDamlInput;
void wrongReissuanceDamlInput;
void wrongRepurchaseDamlInput;
void wrongConversionRatioDamlInput;
void wrongSplit;
void wrongConsolidation;
void wrongReissuance;
void wrongRepurchase;
void wrongConversionRatio;
void invalidRounding;
