/** Built manual transfer converter inputs must exactly mirror generated DAML payloads. */

import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import type { DamlConvertibleTransferData } from '../../dist/functions/OpenCapTable/convertibleTransfer/damlToOcf';
import type { DamlEquityCompensationTransferData } from '../../dist/functions/OpenCapTable/equityCompensationTransfer/damlToOcf';
import type { DamlStockTransferData } from '../../dist/functions/OpenCapTable/stockTransfer/damlToOcf';
import type { DamlWarrantTransferData } from '../../dist/functions/OpenCapTable/warrantTransfer/damlToOcf';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const stockInputIsExact: Assert<IsExactly<DamlStockTransferData, DamlDataTypeFor<'stockTransfer'>>> = true;
const convertibleInputIsExact: Assert<IsExactly<DamlConvertibleTransferData, DamlDataTypeFor<'convertibleTransfer'>>> =
  true;
const equityCompensationInputIsExact: Assert<
  IsExactly<DamlEquityCompensationTransferData, DamlDataTypeFor<'equityCompensationTransfer'>>
> = true;
const warrantInputIsExact: Assert<IsExactly<DamlWarrantTransferData, DamlDataTypeFor<'warrantTransfer'>>> = true;

void stockInputIsExact;
void convertibleInputIsExact;
void equityCompensationInputIsExact;
void warrantInputIsExact;
