import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfVestingEvent } from '../../../types/native';
import { damlVestingEventToNative, type DamlVestingEventData } from './damlToOcf';

export interface GetVestingEventAsOcfParams {
  contractId: string;
}

export interface GetVestingEventAsOcfResult {
  vestingEvent: OcfVestingEvent & { object_type: 'TX_VESTING_EVENT' };
  contractId: string;
}

/**
 * Retrieve a vesting event transaction contract and return it as an OCF JSON object.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The vesting event data in OCF format along with the contract ID
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/vesting/VestingEvent.schema.json
 */
export async function getVestingEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetVestingEventAsOcfParams
): Promise<GetVestingEventAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('No createArgument found for contract', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;

  function hasVestingEventData(arg: unknown): arg is { vesting_event_data: DamlVestingEventData } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'vesting_event_data' in record &&
      typeof record.vesting_event_data === 'object'
    );
  }

  if (!hasVestingEventData(createArgument)) {
    throw new OcpParseError('Unexpected createArgument shape for VestingEvent', {
      source: 'VestingEvent.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const native = damlVestingEventToNative(createArgument.vesting_event_data);
  return {
    vestingEvent: {
      object_type: 'TX_VESTING_EVENT' as const,
      ...native,
    },
    contractId: params.contractId,
  };
}
