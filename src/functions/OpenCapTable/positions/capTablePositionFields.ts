/**
 * Read the position fields that OpenCapTable-v34 0.0.4 appended to the CapTable root.
 *
 * @module capTablePositionFields
 */

import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { parseDamlMap } from '../../../utils/typeConversions';
import type { CapTablePositionFields } from './positionTypes';

/**
 * Decode one `Optional (Map Text Text)` field (or `Optional (Map Text (ContractId _))`). Absent (a 0.0.3 payload) and
 * `null` (`None`) both read as empty.
 */
function readOptionalTextMap(
  createArgument: Record<string, unknown>,
  field: string,
  contractId: string | undefined
): ReadonlyMap<string, string> {
  const raw = createArgument[field];
  if (raw === undefined || raw === null) return new Map();

  let entries: Array<[string, unknown]>;
  try {
    entries = parseDamlMap<string, unknown>(raw);
  } catch (error) {
    throw new OcpParseError(
      `CapTable ${field} is not a DAML Map: ${error instanceof Error ? error.message : String(error)}`,
      {
        source: `CapTable.${field}`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_cap_table_position_field',
        context: { contractId, field },
        ...(error instanceof Error ? { cause: error } : {}),
      }
    );
  }

  const map = new Map<string, string>();
  for (const [index, [key, value]] of entries.entries()) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new OcpParseError(`CapTable ${field} entry ${index} must map to a non-empty string`, {
        source: `CapTable.${field}[${index}]`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_cap_table_position_field',
        context: { contractId, field, key },
      });
    }
    map.set(key, value);
  }
  return map;
}

/**
 * Read the managed classes, migrated securities and their ancestors from a CapTable payload (`createArgument`).
 *
 * A 0.0.3 CapTable has none of these fields and reads as "no positions" (`enabled: false`, empty maps).
 *
 * @param createArgument - The CapTable contract's create argument
 * @param contractId - CapTable contract ID, for diagnostics
 * @throws OcpParseError when a present field is not a DAML Map of strings
 */
export function readCapTablePositionFields(
  createArgument: Record<string, unknown>,
  contractId?: string
): CapTablePositionFields {
  const registries = readOptionalTextMap(createArgument, 'position_registries', contractId);
  const migratedSecurityIds = readOptionalTextMap(createArgument, 'position_migrated_security_ids', contractId);
  const ancestorSecurityIds = readOptionalTextMap(createArgument, 'position_ancestor_security_ids', contractId);
  return {
    // The ledger guard runs unless all three maps are empty.
    enabled: registries.size > 0 || migratedSecurityIds.size > 0 || ancestorSecurityIds.size > 0,
    registries,
    migratedSecurityIds,
    ancestorSecurityIds,
  };
}
