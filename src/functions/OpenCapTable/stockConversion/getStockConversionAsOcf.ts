import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockConversion } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

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
  if (!conversionData || typeof conversionData !== 'object' || Array.isArray(conversionData)) {
    throw new OcpContractError('StockConversion data not found in contract create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const d = conversionData as Record<string, unknown>;

  // Validate quantity
  if (d.quantity === undefined || d.quantity === null) {
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
    id: d.id as string,
    date: (d.date as string).split('T')[0],
    security_id: d.security_id as string,
    quantity: normalizeNumericString(typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id as string } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments as string[] } : {}),
  };

  return { event, contractId: params.contractId };
}
