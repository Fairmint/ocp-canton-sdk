/** Built-declaration contracts for complex issuance readers and converter inputs. */

import type {
  Monetary,
  OcfConvertibleIssuance,
  OcfEquityCompensationIssuance,
  OcfWarrantIssuance,
  OcpClient,
} from '../../dist';
import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import type {
  convertibleIssuanceDataToDaml,
  ConvertibleIssuanceInput,
} from '../../dist/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import type {
  DamlConvertibleIssuanceData,
  damlConvertibleIssuanceDataToNative,
  GetConvertibleIssuanceAsOcfResult,
} from '../../dist/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import type {
  equityCompensationIssuanceDataToDaml,
  EquityCompensationIssuanceInput,
} from '../../dist/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import type {
  DamlEquityCompensationIssuanceData,
  damlEquityCompensationIssuanceDataToNative,
  GetEquityCompensationIssuanceAsOcfResult,
} from '../../dist/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import type {
  warrantIssuanceDataToDaml,
  WarrantIssuanceInput,
} from '../../dist/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import type {
  DamlWarrantIssuanceData,
  damlWarrantIssuanceDataToNative,
  GetWarrantIssuanceAsOcfResult,
} from '../../dist/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type ConvertibleEvent = GetConvertibleIssuanceAsOcfResult['event'];
type EquityCompensationEvent = GetEquityCompensationIssuanceAsOcfResult['event'];
type WarrantEvent = GetWarrantIssuanceAsOcfResult['warrantIssuance'];
type ConvertibleInput = Parameters<typeof damlConvertibleIssuanceDataToNative>[0];
type EquityCompensationInput = Parameters<typeof damlEquityCompensationIssuanceDataToNative>[0];
type WarrantInput = Parameters<typeof damlWarrantIssuanceDataToNative>[0];
type ConvertibleWriterInput = Parameters<typeof convertibleIssuanceDataToDaml>[0];
type EquityCompensationWriterInput = Parameters<typeof equityCompensationIssuanceDataToDaml>[0];
type WarrantWriterInput = Parameters<typeof warrantIssuanceDataToDaml>[0];
type ConvertibleWriterOutput = ReturnType<typeof convertibleIssuanceDataToDaml>;
type EquityCompensationWriterOutput = ReturnType<typeof equityCompensationIssuanceDataToDaml>;
type WarrantWriterOutput = ReturnType<typeof warrantIssuanceDataToDaml>;

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
const convertibleWriterInputIsExact: Assert<IsExactly<ConvertibleWriterInput, ConvertibleIssuanceInput>> = true;
const equityCompensationWriterInputIsExact: Assert<
  IsExactly<EquityCompensationWriterInput, EquityCompensationIssuanceInput>
> = true;
const warrantWriterInputIsExact: Assert<IsExactly<WarrantWriterInput, WarrantIssuanceInput>> = true;
const convertibleWriterOutputIsExact: Assert<
  IsExactly<ConvertibleWriterOutput, DamlDataTypeFor<'convertibleIssuance'>>
> = true;
const equityCompensationWriterOutputIsExact: Assert<
  IsExactly<EquityCompensationWriterOutput, DamlDataTypeFor<'equityCompensationIssuance'>>
> = true;
const warrantWriterOutputIsExact: Assert<IsExactly<WarrantWriterOutput, DamlDataTypeFor<'warrantIssuance'>>> = true;
const convertibleWriterOutputIsNotAny: Assert<IsExactly<IsAny<ConvertibleWriterOutput>, false>> = true;
const equityCompensationWriterOutputIsNotAny: Assert<IsExactly<IsAny<EquityCompensationWriterOutput>, false>> = true;
const warrantWriterOutputIsNotAny: Assert<IsExactly<IsAny<WarrantWriterOutput>, false>> = true;

declare const convertibleResult: GetConvertibleIssuanceAsOcfResult;
declare const equityCompensationResult: GetEquityCompensationIssuanceAsOcfResult;
declare const warrantResult: GetWarrantIssuanceAsOcfResult;
declare const ocpClient: OcpClient;

const convertibleNamespaceResult = ocpClient.OpenCapTable.convertibleIssuance.get({ contractId: 'convertible' });
const equityCompensationNamespaceResult = ocpClient.OpenCapTable.equityCompensationIssuance.get({
  contractId: 'equity-compensation',
});
const warrantNamespaceResult = ocpClient.OpenCapTable.warrantIssuance.get({ contractId: 'warrant' });
const convertibleObjectTypeResult = ocpClient.OpenCapTable.getByObjectType({
  objectType: 'TX_CONVERTIBLE_ISSUANCE',
  contractId: 'convertible',
});
const equityCompensationObjectTypeResult = ocpClient.OpenCapTable.getByObjectType({
  objectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
  contractId: 'equity-compensation',
});
const warrantObjectTypeResult = ocpClient.OpenCapTable.getByObjectType({
  objectType: 'TX_WARRANT_ISSUANCE',
  contractId: 'warrant',
});

type ConvertibleNamespaceData = Awaited<typeof convertibleNamespaceResult>['data'];
type EquityCompensationNamespaceData = Awaited<typeof equityCompensationNamespaceResult>['data'];
type WarrantNamespaceData = Awaited<typeof warrantNamespaceResult>['data'];
type ConvertibleObjectTypeData = Awaited<typeof convertibleObjectTypeResult>['data'];
type EquityCompensationObjectTypeData = Awaited<typeof equityCompensationObjectTypeResult>['data'];
type WarrantObjectTypeData = Awaited<typeof warrantObjectTypeResult>['data'];

const convertibleNamespaceIsExact: Assert<IsExactly<ConvertibleNamespaceData, OcfConvertibleIssuance>> = true;
const equityCompensationNamespaceIsExact: Assert<
  IsExactly<EquityCompensationNamespaceData, OcfEquityCompensationIssuance>
> = true;
const warrantNamespaceIsExact: Assert<IsExactly<WarrantNamespaceData, OcfWarrantIssuance>> = true;
const convertibleObjectTypeIsExact: Assert<IsExactly<ConvertibleObjectTypeData, OcfConvertibleIssuance>> = true;
const equityCompensationObjectTypeIsExact: Assert<
  IsExactly<EquityCompensationObjectTypeData, OcfEquityCompensationIssuance>
> = true;
const warrantObjectTypeIsExact: Assert<IsExactly<WarrantObjectTypeData, OcfWarrantIssuance>> = true;
const convertiblePublicDataIsNotAny: Assert<IsExactly<IsAny<ConvertibleObjectTypeData>, false>> = true;
const equityCompensationPublicDataIsNotAny: Assert<IsExactly<IsAny<EquityCompensationObjectTypeData>, false>> = true;
const warrantPublicDataIsNotAny: Assert<IsExactly<IsAny<WarrantObjectTypeData>, false>> = true;

declare const publicConvertibleData: ConvertibleObjectTypeData;
declare const publicEquityCompensationData: EquityCompensationObjectTypeData;
declare const publicWarrantData: WarrantObjectTypeData;
// @ts-expect-error built package-root convertible data cannot be assigned to the warrant result
const wrongPublicWarrantData: WarrantObjectTypeData = publicConvertibleData;
// @ts-expect-error built package-root equity compensation data cannot be assigned to the convertible result
const wrongPublicConvertibleData: ConvertibleObjectTypeData = publicEquityCompensationData;
// @ts-expect-error built package-root warrant data cannot be assigned to the equity compensation result
const wrongPublicEquityCompensationData: EquityCompensationObjectTypeData = publicWarrantData;

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
void convertibleWriterInputIsExact;
void equityCompensationWriterInputIsExact;
void warrantWriterInputIsExact;
void convertibleWriterOutputIsExact;
void equityCompensationWriterOutputIsExact;
void warrantWriterOutputIsExact;
void convertibleWriterOutputIsNotAny;
void equityCompensationWriterOutputIsNotAny;
void warrantWriterOutputIsNotAny;
void wrongWarrantEvent;
void wrongConvertibleEvent;
void wrongEquityCompensationEvent;
void assertEquityCompensationPricing;
void convertibleNamespaceIsExact;
void equityCompensationNamespaceIsExact;
void warrantNamespaceIsExact;
void convertibleObjectTypeIsExact;
void equityCompensationObjectTypeIsExact;
void warrantObjectTypeIsExact;
void convertiblePublicDataIsNotAny;
void equityCompensationPublicDataIsNotAny;
void warrantPublicDataIsNotAny;
void convertibleNamespaceResult;
void equityCompensationNamespaceResult;
void warrantNamespaceResult;
void convertibleObjectTypeResult;
void equityCompensationObjectTypeResult;
void warrantObjectTypeResult;
void wrongPublicWarrantData;
void wrongPublicConvertibleData;
void wrongPublicEquityCompensationData;
