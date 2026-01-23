import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfValuation } from '../../../types/native';
import { damlValuationToNative, type DamlValuationData } from './damlToOcf';

export interface GetValuationAsOcfParams {
  contractId: string;
}

export interface GetValuationAsOcfResult {
  valuation: OcfValuation & { object_type: 'VALUATION' };
  contractId: string;
}

/**
 * Retrieve a valuation contract and return it as an OCF JSON object.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The valuation data in OCF format along with the contract ID
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Valuation.schema.json
 */
export async function getValuationAsOcf(
  client: LedgerJsonApiClient,
  params: GetValuationAsOcfParams
): Promise<GetValuationAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('No createArgument found for contract', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;

  function hasValuationData(arg: unknown): arg is { valuation_data: DamlValuationData } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' && arg !== null && 'valuation_data' in record && typeof record.valuation_data === 'object'
    );
  }

  if (!hasValuationData(createArgument)) {
    throw new OcpParseError('Unexpected createArgument shape for Valuation', {
      source: 'Valuation.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const native = damlValuationToNative(createArgument.valuation_data);
  return {
    valuation: {
      object_type: 'VALUATION' as const,
      ...native,
    },
    contractId: params.contractId,
  };
}
