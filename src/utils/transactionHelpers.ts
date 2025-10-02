import { OCF_METADATA, type OcfObjectType } from './ocfMetadata';

/** Represents a created event from a transaction tree */
export interface CreatedTreeEvent {
  CreatedTreeEvent: {
    value: {
      contractId: string;
      templateId: string;
      createArgument?: unknown;
    };
  };
}

/**
 * Safely access nested properties in an object
 *
 * @param obj - The object to traverse
 * @param path - Array of keys representing the path to the desired property
 * @returns The value at the path, or undefined if not found
 */
export function safeGet(obj: unknown, path: string[]): unknown {
  let curr = obj as Record<string, unknown> | undefined;
  for (const key of path) {
    if (!curr || typeof curr !== 'object' || !(key in curr)) return undefined;
    curr = curr[key] as Record<string, unknown> | undefined;
  }
  return curr;
}

/**
 * Find all created events in a transaction tree that match a specific template ID
 *
 * @param treeResponse - The transaction tree response from the ledger
 * @param expectedTemplateId - The template ID to filter by
 * @returns Array of matching created events
 */
export function findCreatedEventsByTemplateId(treeResponse: unknown, expectedTemplateId: string): CreatedTreeEvent[] {
  const results: CreatedTreeEvent[] = [];
  if (!treeResponse || typeof treeResponse !== 'object') return results;

  const tr = treeResponse as {
    transaction?: { eventsById?: Record<string, unknown> };
  };
  const eventsById = tr.transaction?.eventsById ?? {};

  // Extract suffix for comparison (handles both full and short template IDs)
  const expectedSuffix = expectedTemplateId.includes(':')
    ? expectedTemplateId.substring(expectedTemplateId.indexOf(':') + 1)
    : expectedTemplateId;

  for (const event of Object.values(eventsById)) {
    if (
      event &&
      typeof event === 'object' &&
      'CreatedTreeEvent' in event &&
      (event as Record<string, unknown>).CreatedTreeEvent &&
      typeof (event as Record<string, unknown>).CreatedTreeEvent === 'object'
    ) {
      const createdEvent = (event as Record<string, unknown>).CreatedTreeEvent as { value?: { templateId?: string } };
      const templateId = createdEvent.value?.templateId;

      if (templateId) {
        const actualSuffix = templateId.includes(':') ? templateId.substring(templateId.indexOf(':') + 1) : templateId;

        if (actualSuffix === expectedSuffix) {
          results.push(event as CreatedTreeEvent);
        }
      }
    }
  }
  return results;
}

/**
 * Extract the OCF ID from a created event's arguments
 *
 * @param event - The created event
 * @param ocfType - The OCF object type
 * @returns The OCF ID string, or undefined if not found
 */
export function extractOcfIdFromEvent(event: CreatedTreeEvent, ocfType: OcfObjectType): string | undefined {
  const metadata = OCF_METADATA[ocfType];
  const ocfId = safeGet(event.CreatedTreeEvent.value.createArgument, metadata.ocfIdPath);
  return typeof ocfId === 'string' ? ocfId : undefined;
}

/**
 * Build a map of OCF IDs to contract IDs from a transaction tree for a specific type
 *
 * @param treeResponse - The transaction tree response
 * @param ocfType - The OCF object type to extract
 * @returns Map of OCF ID to contract ID
 */
export function buildOcfIdToContractIdMap(treeResponse: unknown, ocfType: OcfObjectType): Map<string, string> {
  const metadata = OCF_METADATA[ocfType];
  const events = findCreatedEventsByTemplateId(treeResponse, metadata.templateId);
  const ocfIdMap = new Map<string, string>();

  for (const event of events) {
    const ocfId = extractOcfIdFromEvent(event, ocfType);
    const { contractId } = event.CreatedTreeEvent.value;
    if (ocfId && contractId) {
      ocfIdMap.set(ocfId, contractId);
    }
  }

  return ocfIdMap;
}

/**
 * Build maps of OCF IDs to contract IDs for all OCF types in a transaction
 *
 * @param treeResponse - The transaction tree response
 * @returns Map of OCF type to (OCF ID -> contract ID) map
 */
export function buildAllOcfIdMaps(treeResponse: unknown): Map<OcfObjectType, Map<string, string>> {
  const allMaps = new Map<OcfObjectType, Map<string, string>>();

  for (const ocfType of Object.keys(OCF_METADATA) as OcfObjectType[]) {
    allMaps.set(ocfType, buildOcfIdToContractIdMap(treeResponse, ocfType));
  }

  return allMaps;
}

/**
 * Build arrays of created events for all OCF types in a transaction
 *
 * @param treeResponse - The transaction tree response
 * @returns Map of OCF type to array of created events
 */
export function buildAllOcfEventArrays(treeResponse: unknown): Map<OcfObjectType, CreatedTreeEvent[]> {
  const allArrays = new Map<OcfObjectType, CreatedTreeEvent[]>();

  for (const [type, metadata] of Object.entries(OCF_METADATA)) {
    const ocfType = type as OcfObjectType;
    const events = findCreatedEventsByTemplateId(treeResponse, metadata.templateId);
    allArrays.set(ocfType, events);
  }

  return allArrays;
}
