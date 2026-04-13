import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfVestingStart } from '../../../types/native';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingStartToNative, type DamlVestingStartData } from './damlToOcf';

export type GetVestingStartAsOcfParams = GetByContractIdParams;

export interface GetVestingStartAsOcfResult {
  vestingStart: OcfVestingStart & { object_type: 'TX_VESTING_START' };
  contractId: string;
}

/**
 * Retrieve a vesting start transaction contract and return it as an OCF JSON object.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The vesting start data in OCF format along with the contract ID
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/vesting/VestingStart.schema.json
 */
export async function getVestingStartAsOcf(
  client: LedgerJsonApiClient,
  params: GetVestingStartAsOcfParams
): Promise<GetVestingStartAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getVestingStartAsOcf',
  });

  function hasVestingStartData(arg: unknown): arg is {
    vesting_data?: DamlVestingStartData;
    vesting_start_data?: DamlVestingStartData;
  } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      ((record.vesting_data !== null && typeof record.vesting_data === 'object') ||
        (record.vesting_start_data !== null && typeof record.vesting_start_data === 'object'))
    );
  }

  if (!hasVestingStartData(createArgument)) {
    throw new OcpParseError('Unexpected createArgument shape for VestingStart', {
      source: 'VestingStart.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const vestingData = createArgument.vesting_data ?? createArgument.vesting_start_data;
  if (!vestingData || typeof vestingData !== 'object') {
    throw new OcpParseError('Unexpected createArgument shape for VestingStart', {
      source: 'VestingStart.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const native = damlVestingStartToNative(vestingData);
  return {
    vestingStart: {
      object_type: 'TX_VESTING_START' as const,
      ...native,
    },
    contractId: params.contractId,
  };
}
