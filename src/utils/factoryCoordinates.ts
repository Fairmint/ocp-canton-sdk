import { types as nodeUtilTypes } from 'node:util';

import type { OcpFactoryCoordinates } from '../clientOptions';
import { OcpErrorCodes, OcpValidationError } from '../errors';

interface FactoryCoordinateValues {
  readonly contractId: string;
  readonly templateId: string;
}

function factoryCoordinateValues(value: unknown): FactoryCoordinateValues | undefined {
  if (typeof value !== 'object' || value === null || nodeUtilTypes.isProxy(value)) {
    return undefined;
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.includes('contractId') || !keys.includes('templateId')) {
    return undefined;
  }

  const contractIdDescriptor = Object.getOwnPropertyDescriptor(value, 'contractId');
  const templateIdDescriptor = Object.getOwnPropertyDescriptor(value, 'templateId');
  if (
    contractIdDescriptor === undefined ||
    !('value' in contractIdDescriptor) ||
    typeof contractIdDescriptor.value !== 'string' ||
    templateIdDescriptor === undefined ||
    !('value' in templateIdDescriptor) ||
    typeof templateIdDescriptor.value !== 'string'
  ) {
    return undefined;
  }

  const { value: contractId } = contractIdDescriptor;
  const { value: templateId } = templateIdDescriptor;
  if (
    contractId.trim().length === 0 ||
    contractId !== contractId.trim() ||
    templateId.trim().length === 0 ||
    templateId !== templateId.trim()
  ) {
    return undefined;
  }

  return { contractId, templateId };
}

/** Internal runtime guard for factory coordinates received from typed or untyped callers. */
export function hasCompleteFactoryCoordinates(value: unknown): value is OcpFactoryCoordinates {
  return factoryCoordinateValues(value) !== undefined;
}

function throwInvalidFactoryCoordinates(value: unknown): never {
  throw new OcpValidationError(
    'factory',
    'factory override must contain exactly non-empty contractId and templateId properties without leading or trailing whitespace',
    {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'exact object with non-empty, whitespace-trimmed string contractId and templateId properties',
      receivedValue: value,
    }
  );
}

/** Validate an optional atomic factory override at every public runtime boundary. */
export function validateFactoryCoordinates(value: unknown): asserts value is OcpFactoryCoordinates | undefined {
  if (value !== undefined && !hasCompleteFactoryCoordinates(value)) {
    throwInvalidFactoryCoordinates(value);
  }
}

/** Validate, project, and freeze factory coordinates received at a public runtime boundary. */
export function snapshotFactoryCoordinates(value: unknown): Readonly<OcpFactoryCoordinates> | undefined {
  if (value === undefined) {
    return undefined;
  }
  const coordinates = factoryCoordinateValues(value);
  if (coordinates === undefined) {
    throwInvalidFactoryCoordinates(value);
  }
  return Object.freeze({ contractId: coordinates.contractId, templateId: coordinates.templateId });
}
