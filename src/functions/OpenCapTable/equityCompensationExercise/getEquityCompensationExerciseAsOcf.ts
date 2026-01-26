import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import { normalizeNumericString } from '../../../utils/typeConversions';

interface OcfEquityCompensationExerciseOutput {
  object_type: 'TX_EQUITY_COMPENSATION_EXERCISE';
  id: string;
  quantity: string | number;
  security_id: string;
  date: string;
  // Optional fields from schema left undefined if not present on DAML event
  consideration_text?: string;
  resulting_security_ids?: string[];
  comments?: string[];
}

export interface GetEquityCompensationExerciseAsOcfParams {
  contractId: string; // ContractId of PlanSecurityExerciseEvent
}

export interface GetEquityCompensationExerciseAsOcfResult {
  event: OcfEquityCompensationExerciseOutput;
  contractId: string;
}

/**
 * Read a PlanSecurityExerciseEvent and return a generic OCF EquityCompensationExercise object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/exercise/EquityCompensationExercise.schema.json
 */
export async function getEquityCompensationExerciseAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationExerciseAsOcfParams
): Promise<GetEquityCompensationExerciseAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('Invalid contract events response: missing created event or create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;

  // Some events nest OCF data under a specific key; fall back to root for backward compatibility
  const d: Record<string, unknown> =
    (createArgument.exercise_data as Record<string, unknown> | undefined) ?? createArgument;

  // Validate quantity
  if (d.quantity === undefined || d.quantity === null) {
    throw new OcpValidationError('equityCompensationExercise.quantity', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  if (typeof d.quantity !== 'string' && typeof d.quantity !== 'number') {
    throw new OcpValidationError(
      'equityCompensationExercise.quantity',
      `Must be string or number, got ${typeof d.quantity}`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string | number',
        receivedValue: d.quantity,
      }
    );
  }

  const ocf: OcfEquityCompensationExerciseOutput = {
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id: d.id as string,
    quantity: normalizeNumericString(typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity),
    security_id: d.security_id as string,
    date: (d.date as string).split('T')[0],
    ...(d.consideration_text ? { consideration_text: d.consideration_text as string } : {}),
    ...(Array.isArray(d.resulting_security_ids) && d.resulting_security_ids.length
      ? { resulting_security_ids: d.resulting_security_ids as string[] }
      : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments as string[] } : {}),
  };

  return { event: ocf, contractId: params.contractId };
}
