import type { NonEmptyArray } from '../../../types/native';
import { toNonEmptyStringArray } from '../../../utils/typeConversions';
import { requiredTextToDaml } from './damlText';

/** Require a generated DAML Text field while preserving schema-valid empty identifiers. */
export function requiredTransferTextToDaml(value: unknown, fieldPath: string): string {
  return requiredTextToDaml(value, fieldPath);
}

/** Encode the required unique result identifiers shared by every transfer writer. */
export function resultingSecurityIdsToDaml(value: unknown, fieldPath: string): NonEmptyArray<string> {
  return toNonEmptyStringArray(value, fieldPath, { uniqueItems: true });
}
