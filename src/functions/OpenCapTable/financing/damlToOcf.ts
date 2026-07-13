import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfFinancing } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/** Convert generated DAML Financing data back to canonical OCF. */
export function damlFinancingToNative(financing: Fairmint.OpenCapTable.OCF.Financing.FinancingOcfData): OcfFinancing {
  return {
    object_type: 'FINANCING',
    id: financing.id,
    date: damlTimeToDateString(financing.date),
    name: financing.name,
    issuance_ids: financing.issuance_ids,
    ...(financing.comments.length > 0 && { comments: financing.comments }),
  };
}
