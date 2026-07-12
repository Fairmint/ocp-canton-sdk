import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import { stockIssuanceDataToDaml, type StockIssuanceInput } from '../../dist/functions/OpenCapTable/stockIssuance/createStockIssuance';
import {
  damlStockIssuanceDataToNative,
  type DamlStockIssuanceData,
  type GetStockIssuanceAsOcfResult,
} from '../../dist/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import type { OcfStockIssuance } from '../../dist/types/native';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const inputIsExact: Assert<IsExactly<Parameters<typeof stockIssuanceDataToDaml>[0], StockIssuanceInput>> = true;
const writerOutputIsExact: Assert<
  IsExactly<ReturnType<typeof stockIssuanceDataToDaml>, DamlDataTypeFor<'stockIssuance'>>
> = true;
const readerInputIsExact: Assert<
  IsExactly<Parameters<typeof damlStockIssuanceDataToNative>[0], DamlStockIssuanceData>
> = true;
const generatedDataIsExact: Assert<IsExactly<DamlStockIssuanceData, DamlDataTypeFor<'stockIssuance'>>> = true;
const namedEventIsExact: Assert<IsExactly<GetStockIssuanceAsOcfResult['event'], OcfStockIssuance>> = true;

void [inputIsExact, writerOutputIsExact, readerInputIsExact, generatedDataIsExact, namedEventIsExact];
