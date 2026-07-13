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
  OcfCreatableEntityType,
  OcfCreateArguments,
  OcfCreateOperation,
  OcfDeletableEntityType,
  OcfDeleteOperation,
  OcfEditableEntityType,
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
        context: { operation, entityType },
      }
    );
  }
}

interface GeneratedOperationDataMap {
  readonly create: OcfCreateData;
  readonly edit: OcfEditData;
  readonly delete: OcfDeleteData;
}

interface GeneratedOperationEntityTypeMap {
  readonly create: OcfCreatableEntityType;
  readonly edit: OcfEditableEntityType;
  readonly delete: OcfDeletableEntityType;
}

type GeneratedOperation = keyof GeneratedOperationDataMap;

interface GeneratedOperationBuilder<Operation extends GeneratedOperation> {
  readonly operation: Operation;
  readonly displayName: Capitalize<Operation>;
  readonly supports: (type: string) => type is GeneratedOperationEntityTypeMap[Operation];
  readonly tagFor: (type: GeneratedOperationEntityTypeMap[Operation]) => GeneratedOperationDataMap[Operation]['tag'];
  readonly decoder: { runWithException: (input: unknown) => GeneratedOperationDataMap[Operation] };
}

const CREATE_OPERATION_BUILDER: GeneratedOperationBuilder<'create'> = {
  operation: 'create',
  displayName: 'Create',
  supports: isOcfCreatableEntityType,
  tagFor: (type) => ENTITY_TAG_MAP[type].create,
  decoder: Fairmint.OpenCapTable.CapTable.OcfCreateData.decoder,
};

const EDIT_OPERATION_BUILDER: GeneratedOperationBuilder<'edit'> = {
  operation: 'edit',
  displayName: 'Edit',
  supports: isOcfEditableEntityType,
  tagFor: (type) => ENTITY_TAG_MAP[type].edit,
  decoder: Fairmint.OpenCapTable.CapTable.OcfEditData.decoder,
};

const DELETE_OPERATION_BUILDER: GeneratedOperationBuilder<'delete'> = {
  operation: 'delete',
  displayName: 'Delete',
  supports: isOcfDeletableEntityType,
  tagFor: (type) => ENTITY_TAG_MAP[type].delete,
  decoder: Fairmint.OpenCapTable.CapTable.OcfDeleteData.decoder,
};

function buildGeneratedOperationData<Operation extends GeneratedOperation>(
  type: OcfEntityType,
  convert: () => unknown,
  builder: GeneratedOperationBuilder<Operation>
): GeneratedOperationDataMap[Operation] {
  if (!builder.supports(type)) {
    throw new OcpValidationError(
      'type',
      `${builder.displayName} operation not supported for entity type: ${String(type)}`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
      }
    );
  }

  return decodeGeneratedOperation(
    builder.decoder,
    { tag: builder.tagFor(type), value: convert() },
    builder.operation,
    type
  );
}

/** @internal Build and validate one generated DAML create variant. */
export function buildOcfCreateData<const Arguments extends OcfCreateArguments>(
  ...args: Arguments
): OcfCreateDataFor<Arguments[0]>;
export function buildOcfCreateData(...args: OcfCreateArguments): OcfCreateData {
  const [type] = args;
  return buildGeneratedOperationData(type, () => convertToDaml(...args), CREATE_OPERATION_BUILDER);
}

export function buildOcfCreateDataFromOperation(operation: OcfCreateOperation): OcfCreateData {
  const { type } = operation;
  return buildGeneratedOperationData(type, () => convertOperationToDaml(operation), CREATE_OPERATION_BUILDER);
}

/** @internal Build and validate one generated DAML edit variant. */
export function buildOcfEditData<const Arguments extends OcfEditArguments>(
  ...args: Arguments
): OcfEditDataFor<Arguments[0]>;
export function buildOcfEditData(...args: OcfEditArguments): OcfEditData {
  const [type] = args;
  return buildGeneratedOperationData(type, () => convertToDaml(...args), EDIT_OPERATION_BUILDER);
}

export function buildOcfEditDataFromOperation(operation: OcfEditOperation): OcfEditData {
  const { type } = operation;
  return buildGeneratedOperationData(type, () => convertOperationToDaml(operation), EDIT_OPERATION_BUILDER);
}

/** @internal Build and validate one generated DAML delete variant. */
export function buildOcfDeleteData<const EntityType extends OcfDeletableEntityType>(
  type: EntityType,
  id: string
): OcfDeleteDataFor<EntityType>;
export function buildOcfDeleteData(type: OcfDeletableEntityType, id: string): OcfDeleteData {
  return buildGeneratedOperationData(type, () => id, DELETE_OPERATION_BUILDER);
}

export function buildOcfDeleteDataFromOperation(operation: OcfDeleteOperation): OcfDeleteData {
  const { type } = operation;
  return buildGeneratedOperationData(type, () => operation.id, DELETE_OPERATION_BUILDER);
}
