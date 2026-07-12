import { OcpErrorCodes, OcpValidationError } from '../errors';
import type { CapTableContractDetails } from '../types/common';
import {
  inspectExactArray,
  inspectExactObject,
  toExactDataValidationError,
  type ExactObjectSnapshot,
} from './exactObject';
import { validateContractId, validatePartyId, validateRequiredString } from './validation';

const CAP_TABLE_CONTRACT_DETAIL_KEYS = new Set(['templateId', 'contractId', 'createdEventBlob', 'synchronizerId']);
const CAP_TABLE_DISCLOSURE_KEYS = ['contractId', 'createdEventBlob', 'synchronizerId'] as const;

function explicitUndefined(path: string): never {
  throw new OcpValidationError(path, 'Optional command parameter must be omitted rather than set to undefined.', {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType: 'defined value or omitted property',
  });
}

export function requiredCommandParameter(snapshot: ExactObjectSnapshot, key: string, root: string): unknown {
  if (!snapshot.has(key)) {
    throw new OcpValidationError(`${root}.${key}`, `Required command parameter ${key} is missing.`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'present own data property',
    });
  }
  const value = snapshot.get(key);
  if (value === undefined) {
    throw new OcpValidationError(`${root}.${key}`, `Required command parameter ${key} cannot be undefined.`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'defined value',
    });
  }
  return value;
}

export function optionalCommandParameter(snapshot: ExactObjectSnapshot, key: string, root: string): unknown {
  if (!snapshot.has(key)) return undefined;
  const value = snapshot.get(key);
  return value === undefined ? explicitUndefined(`${root}.${key}`) : value;
}

export function requiredContractId(value: unknown, path: string): string {
  validateContractId(value, path);
  return value;
}

export function requiredPartyId(value: unknown, path: string): string {
  validatePartyId(value, path);
  return value;
}

export function requiredTrimmedString(value: unknown, path: string): string {
  validateRequiredString(value, path);
  if (value !== value.trim()) {
    throw new OcpValidationError(path, 'Required string must not have leading or trailing whitespace.', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty, whitespace-trimmed string',
      receivedValue: value,
    });
  }
  return value;
}

export function snapshotPartyIdArray(
  value: unknown,
  path: string,
  options: { readonly nonEmpty?: boolean } = {}
): readonly string[] {
  const inspection = inspectExactArray(value);
  if (!inspection.ok) {
    throw toExactDataValidationError(path, inspection, {
      message: 'Party scope must be a dense plain array with own data elements.',
      expectedType: 'dense plain array of Canton party IDs',
    });
  }
  if (options.nonEmpty === true && inspection.values.length === 0) {
    throw new OcpValidationError(path, 'Party scope must contain at least one party ID.', {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'non-empty array of Canton party IDs',
      receivedValue: inspection.values,
    });
  }

  const parties = inspection.values.map((party, index) => requiredPartyId(party, `${path}[${index}]`));
  Object.freeze(parties);
  return parties;
}

export function snapshotCapTableContractDetails(
  value: unknown,
  path: string,
  expectedContractId: string
): CapTableContractDetails {
  const inspection = inspectExactObject(value, { allowedKeys: CAP_TABLE_CONTRACT_DETAIL_KEYS });
  if (!inspection.ok) {
    throw toExactDataValidationError(path, inspection, {
      message: 'Cap table contract details must contain only template or Canton disclosed-contract fields.',
      expectedType: 'exact template reference or recognized Canton disclosed-contract carrier',
    });
  }
  const templateId = requiredTrimmedString(
    requiredCommandParameter(inspection.snapshot, 'templateId', path),
    `${path}.templateId`
  );
  for (const key of CAP_TABLE_DISCLOSURE_KEYS) {
    if (!inspection.snapshot.has(key)) continue;
    const carrierValue = inspection.snapshot.get(key);
    if (carrierValue === undefined) continue;
    if (key === 'contractId') {
      const contractId = requiredContractId(carrierValue, `${path}.contractId`);
      if (contractId !== expectedContractId) {
        throw new OcpValidationError(
          `${path}.contractId`,
          'Cap table contract details must match capTableContractId.',
          {
            code: OcpErrorCodes.INVALID_FORMAT,
            expectedType: expectedContractId,
            receivedValue: contractId,
          }
        );
      }
    } else {
      requiredTrimmedString(carrierValue, `${path}.${key}`);
    }
  }
  return Object.freeze({ templateId });
}
