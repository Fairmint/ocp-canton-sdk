/** @internal Generated DAML operation construction for CapTableBatch. */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import {
  ENTITY_TAG_MAP,
  type OcfCreateData,
  type OcfCreateDataFor,
  type OcfDeleteData,
  type OcfDeleteDataFor,
  type OcfEditData,
  type OcfEditDataFor,
} from './batchTypes';
import type {
  OcfCreateArguments,
  OcfCreateOperation,
  OcfDeletableEntityType,
  OcfDeleteOperation,
  OcfEditArguments,
  OcfEditOperation,
  OcfEntityType,
} from './entityTypes';
import { isOcfCreatableEntityType, isOcfDeletableEntityType, isOcfEditableEntityType } from './entityTypes';
import { convertOperationToDaml, convertToDaml } from './ocfToDaml';

function decodeGeneratedOperation<T>(
  decoder: { runWithException: (input: unknown) => T },
  input: unknown,
  operation: 'create' | 'edit' | 'delete',
  entityType: OcfEntityType
): T {
  try {
    return decoder.runWithException(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OcpValidationError(
      `batch.${operation}.${entityType}`,
      `Converter output does not match the generated DAML ${operation} variant: ${message}`,
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: input,
      }
    );
  }
}

function buildOcfCreateDataWith(type: OcfEntityType, convert: () => unknown): OcfCreateData {
  if (!isOcfCreatableEntityType(type)) {
    throw new OcpValidationError('type', `Create operation not supported for entity type: ${String(type)}`, {
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  return decodeGeneratedOperation(
    Fairmint.OpenCapTable.CapTable.OcfCreateData.decoder,
    { tag: ENTITY_TAG_MAP[type].create, value: convert() },
    'create',
    type
  );
}

/** @internal Build and validate one generated DAML create variant. */
export function buildOcfCreateData<const Arguments extends OcfCreateArguments>(
  ...args: Arguments
): OcfCreateDataFor<Arguments[0]>;
export function buildOcfCreateData(...args: OcfCreateArguments): OcfCreateData {
  const [type] = args;
  return buildOcfCreateDataWith(type, () => convertToDaml(...args));
}

export function buildOcfCreateDataFromOperation(operation: OcfCreateOperation): OcfCreateData {
  const { type } = operation;
  return buildOcfCreateDataWith(type, () => convertOperationToDaml(operation));
}

function buildOcfEditDataWith(type: OcfEntityType, convert: () => unknown): OcfEditData {
  if (!isOcfEditableEntityType(type)) {
    throw new OcpValidationError('type', `Edit operation not supported for entity type: ${String(type)}`, {
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  return decodeGeneratedOperation(
    Fairmint.OpenCapTable.CapTable.OcfEditData.decoder,
    { tag: ENTITY_TAG_MAP[type].edit, value: convert() },
    'edit',
    type
  );
}

/** @internal Build and validate one generated DAML edit variant. */
export function buildOcfEditData<const Arguments extends OcfEditArguments>(
  ...args: Arguments
): OcfEditDataFor<Arguments[0]>;
export function buildOcfEditData(...args: OcfEditArguments): OcfEditData {
  const [type] = args;
  return buildOcfEditDataWith(type, () => convertToDaml(...args));
}

export function buildOcfEditDataFromOperation(operation: OcfEditOperation): OcfEditData {
  const { type } = operation;
  return buildOcfEditDataWith(type, () => convertOperationToDaml(operation));
}

/** @internal Build and validate one generated DAML delete variant. */
export function buildOcfDeleteData<const EntityType extends OcfDeletableEntityType>(
  type: EntityType,
  id: string
): OcfDeleteDataFor<EntityType>;
export function buildOcfDeleteData(type: OcfDeletableEntityType, id: string): OcfDeleteData {
  if (!isOcfDeletableEntityType(type)) {
    throw new OcpValidationError('type', `Delete operation not supported for entity type: ${String(type)}`, {
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  return decodeGeneratedOperation(
    Fairmint.OpenCapTable.CapTable.OcfDeleteData.decoder,
    { tag: ENTITY_TAG_MAP[type].delete, value: id },
    'delete',
    type
  );
}

export function buildOcfDeleteDataFromOperation(operation: OcfDeleteOperation): OcfDeleteData {
  return buildOcfDeleteData(operation.type, operation.id);
}
