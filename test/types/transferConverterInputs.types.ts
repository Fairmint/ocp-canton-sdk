/** Manual transfer converter inputs must exactly mirror generated DAML payloads. */

import type { DamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { convertibleTransferDataToDaml } from '../../src/functions/OpenCapTable/convertibleTransfer/convertibleTransferDataToDaml';
import type { DamlConvertibleTransferData } from '../../src/functions/OpenCapTable/convertibleTransfer/damlToOcf';
import type { DamlEquityCompensationTransferData } from '../../src/functions/OpenCapTable/equityCompensationTransfer/damlToOcf';
import type { equityCompensationTransferDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationTransfer/equityCompensationTransferDataToDaml';
import type { stockTransferDataToDaml } from '../../src/functions/OpenCapTable/stockTransfer/createStockTransfer';
import type { DamlStockTransferData } from '../../src/functions/OpenCapTable/stockTransfer/damlToOcf';
import type { DamlWarrantTransferData } from '../../src/functions/OpenCapTable/warrantTransfer/damlToOcf';
import type { warrantTransferDataToDaml } from '../../src/functions/OpenCapTable/warrantTransfer/warrantTransferDataToDaml';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const stockInputIsExact: Assert<IsExactly<DamlStockTransferData, DamlDataTypeFor<'stockTransfer'>>> = true;
const convertibleInputIsExact: Assert<IsExactly<DamlConvertibleTransferData, DamlDataTypeFor<'convertibleTransfer'>>> =
  true;
const equityCompensationInputIsExact: Assert<
  IsExactly<DamlEquityCompensationTransferData, DamlDataTypeFor<'equityCompensationTransfer'>>
> = true;
const warrantInputIsExact: Assert<IsExactly<DamlWarrantTransferData, DamlDataTypeFor<'warrantTransfer'>>> = true;
const stockWriterIsExact: Assert<
  IsExactly<ReturnType<typeof stockTransferDataToDaml>, DamlDataTypeFor<'stockTransfer'>>
> = true;
const convertibleWriterIsExact: Assert<
  IsExactly<ReturnType<typeof convertibleTransferDataToDaml>, DamlDataTypeFor<'convertibleTransfer'>>
> = true;
const equityCompensationWriterIsExact: Assert<
  IsExactly<ReturnType<typeof equityCompensationTransferDataToDaml>, DamlDataTypeFor<'equityCompensationTransfer'>>
> = true;
const warrantWriterIsExact: Assert<
  IsExactly<ReturnType<typeof warrantTransferDataToDaml>, DamlDataTypeFor<'warrantTransfer'>>
> = true;
const writerHasNoStringIndex: Assert<
  IsExactly<string extends keyof ReturnType<typeof stockTransferDataToDaml> ? true : false, false>
> = true;

void stockInputIsExact;
void convertibleInputIsExact;
void equityCompensationInputIsExact;
void warrantInputIsExact;
void stockWriterIsExact;
void convertibleWriterIsExact;
void equityCompensationWriterIsExact;
void warrantWriterIsExact;
void writerHasNoStringIndex;
