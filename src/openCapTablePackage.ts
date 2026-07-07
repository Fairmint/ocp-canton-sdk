import { OCP_TEMPLATES as GENERATED_OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';

function parsePackageName(templateId: string): string {
  const withoutHash = templateId.startsWith('#') ? templateId.slice(1) : templateId;
  const firstColon = withoutHash.indexOf(':');
  if (firstColon < 0) {
    throw new Error(`Invalid OpenCapTable template id: ${templateId}`);
  }

  return withoutHash.slice(0, firstColon);
}

/**
 * SDK-pinned OpenCapTable template ids. This follows the in-wild package line, not the latest generated package
 * published for vnext testing.
 */
export const OCP_TEMPLATES = GENERATED_OCP_TEMPLATES;

/** OpenCapTable package name used by this SDK for default reads and commands. */
export const OPEN_CAP_TABLE_PACKAGE_NAME = parsePackageName(OCP_TEMPLATES.capTable);
