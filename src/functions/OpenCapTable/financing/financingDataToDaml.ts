import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfFinancing } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/** Convert canonical OCF Financing data to the generated DAML representation. */
export function financingDataToDaml(financing: OcfFinancing): Fairmint.OpenCapTable.OCF.Financing.FinancingOcfData {
  return {
    id: financing.id,
    date: dateStringToDAMLTime(financing.date),
    name: financing.name,
    comments: cleanComments(financing.comments),
    issuance_ids: financing.issuance_ids,
  };
}
