import { OcpContractError, OcpErrorCodes } from '../errors';

export interface ParsedTemplateIdentity {
  templateId: string;
  packageRef: string;
  packageName?: string;
  moduleEntityPath: string;
}

export interface TemplateIdentityInput {
  templateId?: unknown;
  packageName?: unknown;
}

type TemplateIdentityMismatch =
  | 'missing_template_id'
  | 'invalid_template_id'
  | 'invalid_expected_template_id'
  | 'module_entity_mismatch'
  | 'missing_package_name'
  | 'package_name_mismatch';

export type TemplateIdentityComparison =
  | Readonly<{
      matches: true;
      actual: ParsedTemplateIdentity;
      expected: ParsedTemplateIdentity;
    }>
  | Readonly<{
      matches: false;
      mismatch: TemplateIdentityMismatch;
      actual?: ParsedTemplateIdentity;
      expected?: ParsedTemplateIdentity;
    }>;

export function parseTemplateIdentity(templateId: string): ParsedTemplateIdentity {
  if (templateId.length === 0) {
    throw new Error('templateId must be a non-empty string');
  }

  const firstColon = templateId.indexOf(':');
  if (firstColon < 0) {
    throw new Error('templateId must include package and module/entity path');
  }

  const packageRef = templateId.slice(0, firstColon);
  const moduleEntityPath = templateId.slice(firstColon + 1);

  if (packageRef.length === 0 || moduleEntityPath.length === 0) {
    throw new Error('templateId must include non-empty package and module/entity path');
  }

  const packageName = packageRef.startsWith('#') ? packageRef.slice(1) : undefined;
  return {
    templateId,
    packageRef,
    ...(packageName !== undefined ? { packageName } : {}),
    moduleEntityPath,
  };
}

export function tryParseTemplateIdentity(templateId: unknown): ParsedTemplateIdentity | null {
  if (typeof templateId !== 'string') return null;
  try {
    return parseTemplateIdentity(templateId);
  } catch {
    return null;
  }
}

export function compareTemplateIdentity(
  actual: TemplateIdentityInput,
  expectedTemplateId: string
): TemplateIdentityComparison {
  const expected = tryParseTemplateIdentity(expectedTemplateId);
  if (!expected) {
    return { matches: false, mismatch: 'invalid_expected_template_id' };
  }

  const parsedActual = tryParseTemplateIdentity(actual.templateId);
  if (actual.templateId === undefined) {
    return { matches: false, mismatch: 'missing_template_id', expected };
  }
  if (!parsedActual) {
    return { matches: false, mismatch: 'invalid_template_id', expected };
  }
  if (parsedActual.moduleEntityPath !== expected.moduleEntityPath) {
    return { matches: false, mismatch: 'module_entity_mismatch', actual: parsedActual, expected };
  }

  const actualPackageName =
    typeof actual.packageName === 'string' && actual.packageName.length > 0
      ? actual.packageName
      : parsedActual.packageName;

  if (expected.packageName && !actualPackageName) {
    return { matches: false, mismatch: 'missing_package_name', actual: parsedActual, expected };
  }

  if (expected.packageName && actualPackageName && actualPackageName !== expected.packageName) {
    return { matches: false, mismatch: 'package_name_mismatch', actual: parsedActual, expected };
  }

  return { matches: true, actual: parsedActual, expected };
}

export function matchesTemplateIdentity(actual: TemplateIdentityInput, expectedTemplateId: string): boolean {
  return compareTemplateIdentity(actual, expectedTemplateId).matches;
}

export function assertTemplateIdentity(
  actual: TemplateIdentityInput,
  expectedTemplateId: string,
  diagnostics: {
    contractId?: string;
    operation?: string;
    message?: string;
  } = {}
): ParsedTemplateIdentity {
  const comparison = compareTemplateIdentity(actual, expectedTemplateId);
  if (!comparison.matches) {
    const actualTemplateId = typeof actual.templateId === 'string' ? actual.templateId : undefined;
    const actualPackageName = typeof actual.packageName === 'string' ? actual.packageName : undefined;
    throw new OcpContractError(diagnostics.message ?? 'Contract template identity does not match expected template', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      ...(diagnostics.contractId !== undefined ? { contractId: diagnostics.contractId } : {}),
      ...(actualTemplateId !== undefined ? { templateId: actualTemplateId } : {}),
      classification: comparison.mismatch,
      context: {
        ...(diagnostics.operation !== undefined ? { operation: diagnostics.operation } : {}),
        ...(actualPackageName !== undefined ? { actualPackageName } : {}),
        ...(actualTemplateId !== undefined ? { actualTemplateId } : {}),
        ...(comparison.actual !== undefined ? { actualModuleEntityPath: comparison.actual.moduleEntityPath } : {}),
        expectedTemplateId,
        ...(comparison.expected?.packageName !== undefined
          ? { expectedPackageName: comparison.expected.packageName }
          : {}),
        ...(comparison.expected !== undefined
          ? { expectedModuleEntityPath: comparison.expected.moduleEntityPath }
          : {}),
      },
    });
  }

  return comparison.actual;
}
