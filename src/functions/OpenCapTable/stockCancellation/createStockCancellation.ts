import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, OcfStockCancellationTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

export function stockCancellationDataToDaml(d: OcfStockCancellationTxData): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    reason_text: d.reason_text,
    date: dateStringToDAMLTime(d.date),
    quantity: numberToString(d.quantity),
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}

/**
 * @deprecated Use AddStockCancellationParams and buildAddStockCancellationCommand instead.
 */
export interface CreateStockCancellationParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  cancellationData: OcfStockCancellationTxData;
}

/**
 * @deprecated Use buildAddStockCancellationCommand instead.
 */
export function buildCreateStockCancellationCommand(
  params: CreateStockCancellationParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateStockCancellation',
    choiceArgument: {
      cancellation_data: stockCancellationDataToDaml(params.cancellationData),
    },
  });
}
