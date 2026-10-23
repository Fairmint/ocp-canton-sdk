import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcpFactoryIdentity } from '../../../types/setup';

/**
 * Check a party ID passed to a setup call: a non-empty string. The ledger decides whether the party exists; the
 * setup's own rules (three distinct parties) are checked by the calls that need them.
 *
 * @throws OcpValidationError when the value is not a non-empty string
 */
export function requireSetupParty(value: unknown, fieldPath: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new OcpValidationError(fieldPath, 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'party ID',
      receivedValue: value,
    });
  }
}

/**
 * Check a factory ID as `OcpFactory`'s `ensure` does: non-empty with no `:`, since a derived ID is a cap table ID
 * (`<factory_id>-<n>`), a colon and a hash.
 *
 * @throws OcpValidationError when the ID is empty or contains a colon
 */
export function validateFactoryId(factoryId: unknown, fieldPath = 'factoryId'): asserts factoryId is string {
  if (typeof factoryId !== 'string' || factoryId === '') {
    throw new OcpValidationError(fieldPath, 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: factoryId,
    });
  }
  if (factoryId.includes(':')) {
    throw new OcpValidationError(
      fieldPath,
      "A factory ID must not contain ':' (a derived ID is a cap table ID, a colon and a hash)",
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: factoryId,
      }
    );
  }
}

/**
 * Check a factory identity: a valid factory ID, a party and, when given, a template ID.
 *
 * @throws OcpValidationError when the identity is malformed
 */
export function validateFactoryIdentity(
  factory: unknown,
  fieldPath = 'factory'
): asserts factory is OcpFactoryIdentity {
  if (typeof factory !== 'object' || factory === null || Array.isArray(factory)) {
    throw new OcpValidationError(
      fieldPath,
      'The factory must be an identity { factoryId, systemOperator, templateId? }',
      {
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue: factory,
      }
    );
  }
  const identity = factory as Record<string, unknown>;
  validateFactoryId(identity.factoryId, `${fieldPath}.factoryId`);
  requireSetupParty(identity.systemOperator, `${fieldPath}.systemOperator`);
  if (identity.templateId !== undefined && (typeof identity.templateId !== 'string' || identity.templateId === '')) {
    throw new OcpValidationError(`${fieldPath}.templateId`, 'The template ID, when given, must be a non-empty string', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: identity.templateId,
    });
  }
}
