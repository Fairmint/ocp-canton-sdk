import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfConvertibleConversion } from '../../../types/native';
import { isRecord } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';
import type { DamlConvertibleConversionData } from './damlToOcf';

type DamlConvertibleConversionInput = Pick<DamlConvertibleConversionData, 'id' | 'date' | 'security_id'> & {
  reason_text?: string | null;
  trigger_id?: string | null;
  resulting_security_ids?: string[] | null;
  balance_security_id?: string | null;
  capitalization_definition?: Record<string, unknown> | null;
  quantity_converted?: string | number | null;
  comments?: string[] | null;
};

function isDamlConvertibleConversionData(value: unknown): value is DamlConvertibleConversionInput {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.security_id === 'string' &&
    (value.reason_text === undefined || value.reason_text === null || typeof value.reason_text === 'string') &&
    (value.trigger_id === undefined || value.trigger_id === null || typeof value.trigger_id === 'string') &&
    (value.resulting_security_ids === undefined ||
      value.resulting_security_ids === null ||
      (Array.isArray(value.resulting_security_ids) &&
        value.resulting_security_ids.every((id) => typeof id === 'string'))) &&
    (value.balance_security_id === undefined ||
      value.balance_security_id === null ||
      typeof value.balance_security_id === 'string') &&
    (value.capitalization_definition === undefined ||
      value.capitalization_definition === null ||
      isRecord(value.capitalization_definition)) &&
    (value.quantity_converted === undefined ||
      value.quantity_converted === null ||
      typeof value.quantity_converted === 'string' ||
      typeof value.quantity_converted === 'number') &&
    (value.comments === undefined ||
      value.comments === null ||
      (Array.isArray(value.comments) && value.comments.every((comment) => typeof comment === 'string')))
  );
}

/**
 * OCF Convertible Conversion Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export interface OcfConvertibleConversionEvent extends OcfConvertibleConversion {
  object_type: 'TX_CONVERTIBLE_CONVERSION';
}

export type GetConvertibleConversionAsOcfParams = GetByContractIdParams;

export interface GetConvertibleConversionAsOcfResult {
  event: OcfConvertibleConversionEvent;
  contractId: string;
}

/**
 * Read a ConvertibleConversion contract and return a generic OCF ConvertibleConversion object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export async function getConvertibleConversionAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleConversionAsOcfParams
): Promise<GetConvertibleConversionAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleConversionAsOcf',
  });

  const conversionData = createArgument.conversion_data;
  if (!isDamlConvertibleConversionData(conversionData)) {
    throw new OcpContractError('ConvertibleConversion data not found in contract create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const d = conversionData;

  // Validate resulting_security_ids
  if (!d.resulting_security_ids || d.resulting_security_ids.length === 0) {
    throw new OcpValidationError(
      'convertibleConversion.resulting_security_ids',
      'Required field must be a non-empty array',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: d.resulting_security_ids,
      }
    );
  }

  if (!d.reason_text || typeof d.reason_text !== 'string') {
    throw new OcpValidationError('convertibleConversion.reason_text', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.reason_text,
    });
  }

  if (!d.trigger_id || typeof d.trigger_id !== 'string') {
    throw new OcpValidationError('convertibleConversion.trigger_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.trigger_id,
    });
  }

  const event: OcfConvertibleConversionEvent = {
    object_type: 'TX_CONVERTIBLE_CONVERSION',
    id: d.id,
    date: d.date.split('T')[0],
    reason_text: d.reason_text,
    security_id: d.security_id,
    trigger_id: d.trigger_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.capitalization_definition ? { capitalization_definition: d.capitalization_definition } : {}),
    ...(d.quantity_converted !== undefined && d.quantity_converted !== null
      ? {
          quantity_converted:
            typeof d.quantity_converted === 'number' ? d.quantity_converted.toString() : d.quantity_converted,
        }
      : {}),
    ...(d.comments?.length ? { comments: d.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
