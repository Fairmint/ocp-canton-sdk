import { extractEventsFromTransaction } from '@fairmint/canton-node-sdk';
import { OCF_METADATA, type OcfMetadataObjectType } from './ocfMetadata';
import { matchesTemplateIdentity } from './templateIdentity';

/** A created ledger event in the flat transaction shape used by OCF helpers. */
export interface OcfCreatedEvent {
  CreatedEvent: {
    contractId: string;
    templateId: string;
    packageName?: string;
    createArgument?: unknown;
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
 * Find all created events in a transaction that match a specific template ID
 *
 * @param transactionResponse - The submit-and-wait-for-transaction response (or bare transaction)
 * @param expectedTemplateId - The template ID to filter by
 * @returns Array of matching created events
 */
export function findCreatedEventsByTemplateId(
  transactionResponse: unknown,
  expectedTemplateId: string
): OcfCreatedEvent[] {
  let createdEvents: ReturnType<typeof extractEventsFromTransaction>['created'];
  try {
    createdEvents = extractEventsFromTransaction(transactionResponse).created;
  } catch {
    return [];
  }

  return createdEvents
    .filter((event) =>
      matchesTemplateIdentity(
        {
          templateId: event.templateId,
          packageName: event.packageName,
        },
        expectedTemplateId
      )
    )
    .map((event) => ({
      CreatedEvent: {
        contractId: event.contractId,
        templateId: event.templateId,
        ...(event.packageName !== undefined ? { packageName: event.packageName } : {}),
        createArgument: event.createArgument,
      },
    }));
}

/**
 * Extract the OCF ID from a created event's arguments
 *
 * @param event - The created event
 * @param ocfType - The OCF object type
 * @returns The OCF ID string, or undefined if not found
 */
export function extractOcfIdFromEvent(event: OcfCreatedEvent, ocfType: OcfMetadataObjectType): string | undefined {
  const metadata = OCF_METADATA[ocfType];
  const ocfId = safeGet(event.CreatedEvent.createArgument, metadata.ocfIdPath);
  return typeof ocfId === 'string' ? ocfId : undefined;
}

/**
 * Build a map of OCF IDs to contract IDs from a transaction for a specific type
 *
 * @param transactionResponse - The transaction response
 * @param ocfType - The OCF object type to extract
 * @returns Map of OCF ID to contract ID
 */
export function buildOcfIdToContractIdMap(
  transactionResponse: unknown,
  ocfType: OcfMetadataObjectType
): Map<string, string> {
  const metadata = OCF_METADATA[ocfType];
  const events = findCreatedEventsByTemplateId(transactionResponse, metadata.templateId);
  const ocfIdMap = new Map<string, string>();

  for (const event of events) {
    const ocfId = extractOcfIdFromEvent(event, ocfType);
    const { contractId } = event.CreatedEvent;
    if (ocfId && contractId) {
      ocfIdMap.set(ocfId, contractId);
    }
  }

  return ocfIdMap;
}

/**
 * Build maps of OCF IDs to contract IDs for all OCF types in a transaction
 *
 * @param transactionResponse - The transaction response
 * @returns Map of OCF type to (OCF ID -> contract ID) map
 */
export function buildAllOcfIdMaps(transactionResponse: unknown): Map<OcfMetadataObjectType, Map<string, string>> {
  const allMaps = new Map<OcfMetadataObjectType, Map<string, string>>();

  for (const ocfType of Object.keys(OCF_METADATA) as OcfMetadataObjectType[]) {
    allMaps.set(ocfType, buildOcfIdToContractIdMap(transactionResponse, ocfType));
  }

  return allMaps;
}

/**
 * Build arrays of created events for all OCF types in a transaction
 *
 * @param transactionResponse - The transaction response
 * @returns Map of OCF type to array of created events
 */
export function buildAllOcfEventArrays(transactionResponse: unknown): Map<OcfMetadataObjectType, OcfCreatedEvent[]> {
  const allArrays = new Map<OcfMetadataObjectType, OcfCreatedEvent[]>();

  for (const [type, metadata] of Object.entries(OCF_METADATA)) {
    const ocfType = type as OcfMetadataObjectType;
    const events = findCreatedEventsByTemplateId(transactionResponse, metadata.templateId);
    allArrays.set(ocfType, events);
  }

  return allArrays;
}
