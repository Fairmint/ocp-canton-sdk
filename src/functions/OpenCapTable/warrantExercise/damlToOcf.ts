/**
 * DAML to OCF converters for WarrantExercise entities.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfWarrantExercise } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * Convert DAML WarrantExercise data to native OCF format.
 * Used by both getWarrantExerciseAsOcf and the damlToOcf dispatcher.
 *
 * @param d - The DAML warrant exercise data object (untyped for flexibility)
 * @returns The native OCF WarrantExercise object
 */
export function damlWarrantExerciseToNative(d: Record<string, unknown>): OcfWarrantExercise {
  // Validate quantity
  if (d.quantity === undefined || d.quantity === null) {
    throw new OcpValidationError('warrantExercise.quantity', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  if (typeof d.quantity !== 'string' && typeof d.quantity !== 'number') {
    throw new OcpValidationError('warrantExercise.quantity', `Must be string or number, got ${typeof d.quantity}`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string | number',
      receivedValue: d.quantity,
    });
  }

  // Validate resulting_security_ids
  if (!Array.isArray(d.resulting_security_ids) || d.resulting_security_ids.length === 0) {
    throw new OcpValidationError('warrantExercise.resulting_security_ids', 'Required field must be a non-empty array', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.resulting_security_ids,
    });
  }

  // Validate trigger_id
  if (!d.trigger_id || typeof d.trigger_id !== 'string') {
    throw new OcpValidationError('warrantExercise.trigger_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.trigger_id,
    });
  }

  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    trigger_id: d.trigger_id,
    quantity: normalizeNumericString(typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id as string } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text as string } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments as string[] } : {}),
  };
}
