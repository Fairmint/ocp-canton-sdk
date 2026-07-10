import {
  FIELD_TO_ENTITY_TYPE,
  SECURITY_ID_FIELD_TO_ENTITY_TYPE,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';

const REQUIRED_CAP_TABLE_MAP_FIELDS = [
  ...Object.keys(FIELD_TO_ENTITY_TYPE),
  ...Object.keys(SECURITY_ID_FIELD_TO_ENTITY_TYPE),
];

/** Build the complete required DAML map shape for a CapTable test create argument. */
export function completeCapTableCreateArgument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...Object.fromEntries(REQUIRED_CAP_TABLE_MAP_FIELDS.map((field) => [field, []])),
    ...overrides,
  };
}
