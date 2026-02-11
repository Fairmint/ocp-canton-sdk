import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockConversion } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';
import type { DamlStockConversionData } from './damlToOcf';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

type DamlStockConversionInput = Pick<DamlStockConversionData, 'id' | 'date' | 'security_id'> & {
  quantity?: string | number;
  resulting_security_ids?: unknown;
  comments?: unknown;
  balance_security_id?: string | null;
};

function isDamlStockConversionData(value: unknown): value is DamlStockConversionInput {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.security_id === 'string' &&
    (value.balance_security_id === undefined ||
      value.balance_security_id === null ||
      typeof value.balance_security_id === 'string')
  );
}

/**
 * OCF Stock Conversion Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/conversion/StockConversion.schema.json
 */
export interface OcfStockConversionEvent extends Omit<OcfStockConversion, 'quantity'> {
  object_type: 'TX_STOCK_CONVERSION';
  /** Quantity as string for OCF JSON serialization */
  quantity: string;
}

export interface GetStockConversionAsOcfParams {
  contractId: string;
}

export interface GetStockConversionAsOcfResult {
  event: OcfStockConversionEvent;
  contractId: string;
}

/**
 * Read a StockConversion contract and return a generic OCF StockConversion object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/conversion/StockConversion.schema.json
 */
export async function getStockConversionAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockConversionAsOcfParams
): Promise<GetStockConversionAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('Invalid contract events response: missing created event or create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;

  const conversionData = createArgument.conversion_data;
  if (!isDamlStockConversionData(conversionData)) {
    throw new OcpContractError('StockConversion data not found in contract create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const d = conversionData;

  // Validate quantity
  if (d.quantity == null) {
    throw new OcpValidationError('stockConversion.quantity', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  if (typeof d.quantity !== 'string' && typeof d.quantity !== 'number') {
    throw new OcpValidationError('stockConversion.quantity', `Must be string or number, got ${typeof d.quantity}`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string | number',
      receivedValue: d.quantity,
    });
  }

  // Validate resulting_security_ids
  if (!Array.isArray(d.resulting_security_ids) || d.resulting_security_ids.length === 0) {
    throw new OcpValidationError('stockConversion.resulting_security_ids', 'Required field must be a non-empty array', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.resulting_security_ids,
    });
  }

  const event: OcfStockConversionEvent = {
    object_type: 'TX_STOCK_CONVERSION',
    id: d.id,
    date: d.date.split('T')[0],
    security_id: d.security_id,
    quantity: normalizeNumericString(typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments as string[] } : {}),
  };

  return { event, contractId: params.contractId };
}
