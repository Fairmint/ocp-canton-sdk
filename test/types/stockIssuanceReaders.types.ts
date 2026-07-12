import type { OcpClient } from '../../src';
import type { DamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  type stockIssuanceDataToDaml,
  type StockIssuanceInput,
} from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import {
  type DamlStockIssuanceData,
  type damlStockIssuanceDataToNative,
  type GetStockIssuanceAsOcfResult,
} from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import type { OcfStockIssuance } from '../../src/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type WriterInput = Parameters<typeof stockIssuanceDataToDaml>[0];
type WriterOutput = ReturnType<typeof stockIssuanceDataToDaml>;
type ReaderInput = Parameters<typeof damlStockIssuanceDataToNative>[0];
type NamedEvent = GetStockIssuanceAsOcfResult['event'];

declare const ocpClient: OcpClient;
const namespaceResult = ocpClient.OpenCapTable.stockIssuance.get({ contractId: 'stock-issuance' });
const objectTypeResult = ocpClient.OpenCapTable.getByObjectType({
  objectType: 'TX_STOCK_ISSUANCE',
  contractId: 'stock-issuance',
});
type NamespaceData = Awaited<typeof namespaceResult>['data'];
type ObjectTypeData = Awaited<typeof objectTypeResult>['data'];

const inputIsExact: Assert<IsExactly<WriterInput, StockIssuanceInput>> = true;
const writerOutputIsExact: Assert<IsExactly<WriterOutput, DamlDataTypeFor<'stockIssuance'>>> = true;
const readerInputIsExact: Assert<IsExactly<ReaderInput, DamlStockIssuanceData>> = true;
const generatedDataIsExact: Assert<IsExactly<DamlStockIssuanceData, DamlDataTypeFor<'stockIssuance'>>> = true;
const namedEventIsExact: Assert<IsExactly<NamedEvent, OcfStockIssuance>> = true;
const namespaceDataIsExact: Assert<IsExactly<NamespaceData, OcfStockIssuance>> = true;
const objectTypeDataIsExact: Assert<IsExactly<ObjectTypeData, OcfStockIssuance>> = true;
const inputIsNotAny: Assert<IsExactly<IsAny<WriterInput>, false>> = true;
const writerOutputIsNotAny: Assert<IsExactly<IsAny<WriterOutput>, false>> = true;
const readerInputIsNotAny: Assert<IsExactly<IsAny<ReaderInput>, false>> = true;
const namedEventIsNotAny: Assert<IsExactly<IsAny<NamedEvent>, false>> = true;
const namespaceDataIsNotAny: Assert<IsExactly<IsAny<NamespaceData>, false>> = true;
const objectTypeDataIsNotAny: Assert<IsExactly<IsAny<ObjectTypeData>, false>> = true;

void [
  inputIsExact,
  writerOutputIsExact,
  readerInputIsExact,
  generatedDataIsExact,
  namedEventIsExact,
  namespaceDataIsExact,
  objectTypeDataIsExact,
  inputIsNotAny,
  writerOutputIsNotAny,
  readerInputIsNotAny,
  namedEventIsNotAny,
  namespaceDataIsNotAny,
  objectTypeDataIsNotAny,
  namespaceResult,
  objectTypeResult,
];
