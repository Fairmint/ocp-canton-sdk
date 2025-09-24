import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlVestingTermsDataToNative } from '../../utils/typeConversions';

export interface OcfVestingTerms {
  object_type: 'VESTING_TERMS';
  id?: string;
  name: string;
  description: string;
  allocation_type: string;
  vesting_conditions: any[];
  comments?: string[];
}

export interface GetVestingTermsAsOcfParams {
  contractId: string;
}

export interface GetVestingTermsAsOcfResult {
  vestingTerms: OcfVestingTerms;
  contractId: string;
}

/**
 * Retrieve vesting terms and return them as an OCF JSON object
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/VestingTerms.schema.json
 */
export async function getVestingTermsAsOcf(
  client: LedgerJsonApiClient,
  params: GetVestingTermsAsOcfParams
): Promise<GetVestingTermsAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument;

  function hasData(arg: unknown): arg is { vesting_terms_data: Fairmint.OpenCapTable.VestingTerms.OcfVestingTermsData } {
    return typeof arg === 'object' && arg !== null && 'vesting_terms_data' in arg && typeof (arg as any).vesting_terms_data === 'object';
  }
  if (!hasData(createArgument)) {
    throw new Error('Vesting terms data not found in contract create argument');
  }

  const native = damlVestingTermsDataToNative(createArgument.vesting_terms_data) as any;
  const { id, ...nativeWithoutId } = native;

  const ocf: OcfVestingTerms = {
    object_type: 'VESTING_TERMS',
    id,
    ...nativeWithoutId
  } as any;

  return { vestingTerms: ocf, contractId: params.contractId };
}
