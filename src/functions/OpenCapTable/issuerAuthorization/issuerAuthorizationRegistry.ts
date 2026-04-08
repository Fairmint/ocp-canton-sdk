import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

import {
  CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE,
  KNOWN_OPEN_CAP_TABLE_PACKAGE_LINES,
  type OpenCapTablePackageLine,
} from '../capTable/capTableRegistry';

export const OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_SUFFIX =
  'Fairmint.OpenCapTable.IssuerAuthorization:IssuerAuthorization';

export interface OpenCapTableIssuerAuthorizationRegistryEntry {
  readonly packageLine: OpenCapTablePackageLine;
  readonly templateId: string;
  readonly isCurrent: boolean;
}

function buildIssuerAuthorizationTemplateId(packageLine: OpenCapTablePackageLine): string {
  return `#${packageLine}:${OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_SUFFIX}`;
}

export const CURRENT_OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_ID =
  Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId;

export const OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_REGISTRY: readonly OpenCapTableIssuerAuthorizationRegistryEntry[] = [
  {
    packageLine: 'OpenCapTable-v25',
    templateId: buildIssuerAuthorizationTemplateId('OpenCapTable-v25'),
    isCurrent: false,
  },
  {
    packageLine: 'OpenCapTable-v30',
    templateId: buildIssuerAuthorizationTemplateId('OpenCapTable-v30'),
    isCurrent: false,
  },
  {
    packageLine: 'OpenCapTable-v33',
    templateId: buildIssuerAuthorizationTemplateId('OpenCapTable-v33'),
    isCurrent: false,
  },
  {
    packageLine: CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE,
    templateId: CURRENT_OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_ID,
    isCurrent: true,
  },
] as const;

export function getOpenCapTableIssuerAuthorizationRegistryEntry(
  packageLine: OpenCapTablePackageLine
): OpenCapTableIssuerAuthorizationRegistryEntry {
  const entry = OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_REGISTRY.find((candidate) => candidate.packageLine === packageLine);

  if (!entry) {
    throw new Error(`Unsupported OpenCapTable package line: ${packageLine}`);
  }

  return entry;
}

export function getOpenCapTableIssuerAuthorizationTemplateId(
  packageLine: OpenCapTablePackageLine = CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE
): string {
  return getOpenCapTableIssuerAuthorizationRegistryEntry(packageLine).templateId;
}

export function getOpenCapTableIssuerAuthorizationTemplateIds(
  packageLines: readonly OpenCapTablePackageLine[] = KNOWN_OPEN_CAP_TABLE_PACKAGE_LINES
): string[] {
  return packageLines.map((packageLine) => getOpenCapTableIssuerAuthorizationTemplateId(packageLine));
}
