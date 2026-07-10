/** Built-declaration contracts for complex issuance readers and converter inputs. */

import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import type {
  DamlConvertibleIssuanceData,
  GetConvertibleIssuanceAsOcfResult,
  damlConvertibleIssuanceDataToNative,
} from '../../dist/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import type {
  DamlEquityCompensationIssuanceData,
  GetEquityCompensationIssuanceAsOcfResult,
  damlEquityCompensationIssuanceDataToNative,
} from '../../dist/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import type {
  DamlWarrantIssuanceData,
  GetWarrantIssuanceAsOcfResult,
  damlWarrantIssuanceDataToNative,
} from '../../dist/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import type {
  Monetary,
  OcfConvertibleIssuance,
  OcfEquityCompensationIssuance,
  OcfWarrantIssuance,
} from '../../dist/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type ConvertibleEvent = GetConvertibleIssuanceAsOcfResult['event'];
type EquityCompensationEvent = GetEquityCompensationIssuanceAsOcfResult['event'];
type WarrantEvent = GetWarrantIssuanceAsOcfResult['warrantIssuance'];
type ConvertibleInput = Parameters<typeof damlConvertibleIssuanceDataToNative>[0];
type EquityCompensationInput = Parameters<typeof damlEquityCompensationIssuanceDataToNative>[0];
type WarrantInput = Parameters<typeof damlWarrantIssuanceDataToNative>[0];

const convertibleEventIsExact: Assert<IsExactly<ConvertibleEvent, OcfConvertibleIssuance>> = true;
const equityCompensationEventIsExact: Assert<IsExactly<EquityCompensationEvent, OcfEquityCompensationIssuance>> = true;
const warrantEventIsExact: Assert<IsExactly<WarrantEvent, OcfWarrantIssuance>> = true;
const convertibleEventIsNotAny: Assert<IsExactly<IsAny<ConvertibleEvent>, false>> = true;
const equityCompensationEventIsNotAny: Assert<IsExactly<IsAny<EquityCompensationEvent>, false>> = true;
const warrantEventIsNotAny: Assert<IsExactly<IsAny<WarrantEvent>, false>> = true;

const convertibleInputIsExact: Assert<IsExactly<ConvertibleInput, DamlConvertibleIssuanceData>> = true;
const equityCompensationInputIsExact: Assert<IsExactly<EquityCompensationInput, DamlEquityCompensationIssuanceData>> =
  true;
const warrantInputIsExact: Assert<IsExactly<WarrantInput, DamlWarrantIssuanceData>> = true;
const convertibleDamlIsExact: Assert<IsExactly<DamlConvertibleIssuanceData, DamlDataTypeFor<'convertibleIssuance'>>> =
  true;
const equityCompensationDamlIsExact: Assert<
  IsExactly<DamlEquityCompensationIssuanceData, DamlDataTypeFor<'equityCompensationIssuance'>>
> = true;
const warrantDamlIsExact: Assert<IsExactly<DamlWarrantIssuanceData, DamlDataTypeFor<'warrantIssuance'>>> = true;
const convertibleInputIsNotAny: Assert<IsExactly<IsAny<ConvertibleInput>, false>> = true;
const equityCompensationInputIsNotAny: Assert<IsExactly<IsAny<EquityCompensationInput>, false>> = true;
const warrantInputIsNotAny: Assert<IsExactly<IsAny<WarrantInput>, false>> = true;

declare const convertibleResult: GetConvertibleIssuanceAsOcfResult;
declare const equityCompensationResult: GetEquityCompensationIssuanceAsOcfResult;
declare const warrantResult: GetWarrantIssuanceAsOcfResult;

// @ts-expect-error built convertible issuances cannot be used as warrant issuances
const wrongWarrantEvent: OcfWarrantIssuance = convertibleResult.event;
// @ts-expect-error built equity compensation issuances cannot be used as convertible issuances
const wrongConvertibleEvent: OcfConvertibleIssuance = equityCompensationResult.event;
// @ts-expect-error built warrant issuances cannot be used as equity compensation issuances
const wrongEquityCompensationEvent: OcfEquityCompensationIssuance = warrantResult.warrantIssuance;

function assertEquityCompensationPricing(result: GetEquityCompensationIssuanceAsOcfResult): void {
  const { event } = result;
  switch (event.compensation_type) {
    case 'OPTION':
    case 'OPTION_ISO':
    case 'OPTION_NSO': {
      const exercisePrice: Monetary = event.exercise_price;
      // @ts-expect-error built option variants forbid SAR base pricing
      const basePrice: Monetary = event.base_price;
      void basePrice;
      void exercisePrice;
      break;
    }
    case 'CSAR':
    case 'SSAR': {
      const basePrice: Monetary = event.base_price;
      // @ts-expect-error built SAR variants forbid option exercise pricing
      const exercisePrice: Monetary = event.exercise_price;
      void exercisePrice;
      void basePrice;
      break;
    }
    case 'RSU': {
      // @ts-expect-error built RSU variants forbid option exercise pricing
      const exercisePrice: Monetary = event.exercise_price;
      // @ts-expect-error built RSU variants forbid SAR base pricing
      const basePrice: Monetary = event.base_price;
      void exercisePrice;
      void basePrice;
      break;
    }
  }
}

void convertibleEventIsExact;
void equityCompensationEventIsExact;
void warrantEventIsExact;
void convertibleEventIsNotAny;
void equityCompensationEventIsNotAny;
void warrantEventIsNotAny;
void convertibleInputIsExact;
void equityCompensationInputIsExact;
void warrantInputIsExact;
void convertibleDamlIsExact;
void equityCompensationDamlIsExact;
void warrantDamlIsExact;
void convertibleInputIsNotAny;
void equityCompensationInputIsNotAny;
void warrantInputIsNotAny;
void wrongWarrantEvent;
void wrongConvertibleEvent;
void wrongEquityCompensationEvent;
void assertEquityCompensationPricing;
