import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfDocument, OcfObjectReference } from '../../../types/native';
import { ocfEnumValue } from '../../../utils/damlEnums';
import {
  assertSafeGeneratedDamlJson,
  decodeGeneratedDaml,
  extractGeneratedCreateArgumentData,
  rejectUnknownGeneratedFields,
  requireGeneratedArray,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
import { validateMd5, validateRequiredString } from '../../../utils/validation';
import { readSingleContract } from '../shared/singleContractRead';

function objectTypeToNative(t: string): OcfObjectReference['object_type'] {
  const objectType = ocfEnumValue('OcfObjectType', t, 'objectReference.object_type');
  if (objectType === 'TX_STOCK_HOLD' || objectType === 'TX_STOCK_HOLD_CANCELLATION') {
    throw new OcpParseError(`Unsupported DAML object reference type: ${t}`, {
      source: 'objectReference.object_type',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  return objectType;
}

export function damlDocumentDataToNative(d: Fairmint.OpenCapTable.OCF.Document.DocumentOcfData): OcfDocument {
  const rootPath = 'document';
  assertSafeGeneratedDamlJson(d, rootPath);
  const source = requireGeneratedRecord(d, rootPath);
  rejectUnknownGeneratedFields(source, rootPath, ['id', 'md5', 'comments', 'related_objects', 'path', 'uri']);
  requireGeneratedString(source.id, `${rootPath}.id`);
  requireGeneratedString(source.md5, `${rootPath}.md5`);
  validateMd5(source.md5, `${rootPath}.md5`);
  requireGeneratedStringArray(source.comments, `${rootPath}.comments`);
  const relatedObjects = requireGeneratedArray(source.related_objects, `${rootPath}.related_objects`);
  relatedObjects.forEach((reference, index) => {
    const referencePath = `${rootPath}.related_objects[${index}]`;
    const record = requireGeneratedRecord(reference, referencePath);
    rejectUnknownGeneratedFields(record, referencePath, ['object_id', 'object_type']);
    requireGeneratedString(record.object_id, `${referencePath}.object_id`);
    requireGeneratedString(record.object_type, `${referencePath}.object_type`);
  });
  for (const field of ['path', 'uri'] as const) {
    const value = source[field];
    if (value !== null && value !== undefined && typeof value !== 'string') {
      throw new OcpValidationError(`${rootPath}.${field}`, 'Document location must be a string when provided', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string or null',
        receivedValue: value,
      });
    }
  }

  const decoded = decodeGeneratedDaml(
    d,
    {
      decode: (value) => Fairmint.OpenCapTable.OCF.Document.DocumentOcfData.decoder.runWithException(value),
      encode: (value) => Fairmint.OpenCapTable.OCF.Document.DocumentOcfData.encode(value),
    },
    rootPath
  );
  const { id } = decoded as unknown as { id?: unknown };
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError('document.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }
  const readLocation = (value: unknown, fieldPath: 'document.path' | 'document.uri'): string | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new OcpValidationError(fieldPath, 'Document location must be a string when provided', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string or null',
        receivedValue: value,
      });
    }
    return value;
  };
  const path = readLocation(decoded.path, 'document.path');
  const uri = readLocation(decoded.uri, 'document.uri');
  const common = {
    object_type: 'DOCUMENT',
    id,
    md5: decoded.md5,
    related_objects: decoded.related_objects.map((r) => ({
      object_type: objectTypeToNative(r.object_type),
      object_id: r.object_id,
    })),
    comments: decoded.comments,
  } as const;

  if (path !== undefined && uri === undefined) {
    validateRequiredString(path, 'document.path');
    return { ...common, path };
  }
  if (uri !== undefined && path === undefined) {
    validateRequiredString(uri, 'document.uri');
    return { ...common, uri };
  }

  throw new OcpValidationError('document', 'Document must have exactly one of path or uri', {
    code: path === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_FORMAT,
    expectedType: 'exactly one of path or uri',
    receivedValue: { path: decoded.path, uri: decoded.uri },
  });
}

export interface GetDocumentAsOcfParams extends GetByContractIdParams {}

export interface GetDocumentAsOcfResult {
  document: OcfDocument;
  contractId: string;
}

export async function getDocumentAsOcf(
  client: LedgerJsonApiClient,
  params: GetDocumentAsOcfParams
): Promise<GetDocumentAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getDocumentAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.Document.Document.templateId,
  });

  const argumentPath = 'Document.createArgument';
  const documentData = extractGeneratedCreateArgumentData(createArgument, argumentPath, {
    dataField: 'ocf_data',
  });
  const native = damlDocumentDataToNative(
    documentData as unknown as Fairmint.OpenCapTable.OCF.Document.DocumentOcfData
  );
  return { document: native, contractId: params.contractId };
}
