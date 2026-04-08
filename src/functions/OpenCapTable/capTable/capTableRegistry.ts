import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export const OPEN_CAP_TABLE_CAP_TABLE_TEMPLATE_SUFFIX = 'Fairmint.OpenCapTable.CapTable:CapTable';

export const KNOWN_OPEN_CAP_TABLE_PACKAGE_LINES = [
  'OpenCapTable-v25',
  'OpenCapTable-v30',
  'OpenCapTable-v33',
  'OpenCapTable-v34',
] as const;

export type OpenCapTablePackageLine = (typeof KNOWN_OPEN_CAP_TABLE_PACKAGE_LINES)[number];

export interface OpenCapTableCapTableRegistryEntry {
  readonly packageLine: OpenCapTablePackageLine;
  readonly templateId: string;
  readonly isCurrent: boolean;
}

export const CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE: OpenCapTablePackageLine = 'OpenCapTable-v34';

function buildCapTableTemplateId(packageLine: OpenCapTablePackageLine): string {
  return `#${packageLine}:${OPEN_CAP_TABLE_CAP_TABLE_TEMPLATE_SUFFIX}`;
}

export const OPEN_CAP_TABLE_CAP_TABLE_REGISTRY: readonly OpenCapTableCapTableRegistryEntry[] = [
  {
    packageLine: 'OpenCapTable-v25',
    templateId: buildCapTableTemplateId('OpenCapTable-v25'),
    isCurrent: false,
  },
  {
    packageLine: 'OpenCapTable-v30',
    templateId: buildCapTableTemplateId('OpenCapTable-v30'),
    isCurrent: false,
  },
  {
    packageLine: 'OpenCapTable-v33',
    templateId: buildCapTableTemplateId('OpenCapTable-v33'),
    isCurrent: false,
  },
  {
    packageLine: CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE,
    templateId: Fairmint.OpenCapTable.CapTable.CapTable.templateId,
    isCurrent: true,
  },
] as const;

export function getOpenCapTableCapTableRegistryEntry(
  packageLine: OpenCapTablePackageLine
): OpenCapTableCapTableRegistryEntry {
  const entry = OPEN_CAP_TABLE_CAP_TABLE_REGISTRY.find((candidate) => candidate.packageLine === packageLine);

  if (!entry) {
    throw new Error(`Unsupported OpenCapTable package line: ${packageLine}`);
  }

  return entry;
}

export function getOpenCapTableCapTableTemplateIds(
  packageLines: readonly OpenCapTablePackageLine[] = KNOWN_OPEN_CAP_TABLE_PACKAGE_LINES
): string[] {
  return packageLines.map((packageLine) => getOpenCapTableCapTableRegistryEntry(packageLine).templateId);
}

export function resolveOpenCapTablePackageLine(params: {
  packageName?: string;
  templateId?: string;
}): OpenCapTablePackageLine | null {
  const entryByPackageName = OPEN_CAP_TABLE_CAP_TABLE_REGISTRY.find(
    (candidate) => candidate.packageLine === params.packageName
  );

  if (entryByPackageName) {
    return entryByPackageName.packageLine;
  }

  if (!params.templateId) {
    return null;
  }

  const entryByTemplateId = OPEN_CAP_TABLE_CAP_TABLE_REGISTRY.find(
    (candidate) => candidate.templateId === params.templateId
  );

  if (entryByTemplateId) {
    return entryByTemplateId.packageLine;
  }

  return null;
}
