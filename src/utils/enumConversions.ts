/**
 * Centralized enum conversion utilities for OCF to DAML transformations.
 *
 * This module provides bidirectional converters between native OCF enum values
 * and their DAML equivalents. All enum converters follow the pattern:
 * - `*ToDaml()` - Native OCF → DAML
 * - `daml*ToNative()` - DAML → Native OCF
 *
 * The constructor of every enum follows the v35 naming rule `<TypeName><PascalCase(OCF value)>`, applied and checked
 * against the generated enum by {@link damlEnumConstructor} and {@link ocfEnumValue}.
 *
 * @example
 *   ```typescript
 *   import { emailTypeToDaml, damlEmailTypeToNative } from '../utils/enumConversions';
 *
 *   // Native → DAML
 *   const damlEmailType = emailTypeToDaml('BUSINESS'); // 'OcfEmailTypeBusiness'
 *
 *   // DAML → Native
 *   const nativeEmailType = damlEmailTypeToNative('OcfEmailTypeBusiness'); // 'BUSINESS'
 *   ```
 */

import type {
  EmailType,
  PhoneType,
  StakeholderRelationshipType,
  StakeholderStatus,
  StakeholderType,
  StockClassType,
} from '../types/native';
import {
  OCF_ENUM_VALUES,
  damlEnumConstructor,
  ocfEnumValue,
  type DamlEnumConstructor,
  type DamlEnumTypeName,
} from './damlEnums';

// Keep public utility declarations structural so generated DAML codecs remain
// an implementation detail of the ledger boundary.
type DamlEmailType = DamlEnumConstructor<'OcfEmailType'>;
type DamlPhoneType = DamlEnumConstructor<'OcfPhoneType'>;
type DamlStakeholderType = DamlEnumConstructor<'OcfStakeholderType'>;

/** Convert an OCF value of one enum to its constructor, naming the field in unknown-value errors. */
function toDaml<TypeName extends DamlEnumTypeName>(
  typeName: TypeName,
  value: Parameters<typeof damlEnumConstructor<TypeName>>[1],
  source: string
): DamlEnumConstructor<TypeName> {
  return damlEnumConstructor(typeName, value, source);
}

// ===== Email Type Conversions =====

/**
 * Convert native OCF EmailType to DAML OcfEmailType.
 *
 * @param emailType - Native email type ('PERSONAL' | 'BUSINESS' | 'OTHER')
 * @returns DAML email type enum value
 * @throws OcpParseError if emailType is not a valid value
 */
export function emailTypeToDaml(emailType: EmailType): DamlEmailType {
  return toDaml('OcfEmailType', emailType, 'emailType');
}

/**
 * Convert DAML OcfEmailType to native OCF EmailType.
 *
 * @param damlType - DAML email type enum value
 * @returns Native email type
 * @throws OcpParseError if damlType is not a valid value
 */
export function damlEmailTypeToNative(damlType: DamlEmailType): EmailType {
  return ocfEnumValue('OcfEmailType', damlType, 'damlEmailType');
}

// ===== Phone Type Conversions =====

/**
 * Convert native OCF PhoneType to DAML OcfPhoneType.
 *
 * @param phoneType - Native phone type ('HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER')
 * @returns DAML phone type enum value
 * @throws OcpParseError if phoneType is not a valid value
 */
export function phoneTypeToDaml(phoneType: PhoneType): DamlPhoneType {
  return toDaml('OcfPhoneType', phoneType, 'phoneType');
}

/**
 * Convert DAML OcfPhoneType to native OCF PhoneType.
 *
 * @param damlType - DAML phone type enum value
 * @returns Native phone type
 * @throws OcpParseError if damlType is not a valid value
 */
export function damlPhoneTypeToNative(damlType: DamlPhoneType): PhoneType {
  return ocfEnumValue('OcfPhoneType', damlType, 'damlPhoneType');
}

// ===== Stakeholder Type Conversions =====

/**
 * Convert native OCF StakeholderType to DAML OcfStakeholderType.
 *
 * @param stakeholderType - Native stakeholder type ('INDIVIDUAL' | 'INSTITUTION')
 * @returns DAML stakeholder type enum value
 * @throws OcpParseError if stakeholderType is not a valid value
 */
export function stakeholderTypeToDaml(stakeholderType: StakeholderType): DamlStakeholderType {
  return toDaml('OcfStakeholderType', stakeholderType, 'stakeholderType');
}

/**
 * Convert DAML OcfStakeholderType to native OCF StakeholderType.
 *
 * @param damlType - DAML stakeholder type enum value
 * @returns Native stakeholder type
 * @throws OcpParseError if damlType is not a valid value
 */
export function damlStakeholderTypeToNative(damlType: DamlStakeholderType): StakeholderType {
  return ocfEnumValue('OcfStakeholderType', damlType, 'damlStakeholderType');
}

// ===== Stock Class Type Conversions =====

/**
 * Convert native OCF StockClassType to DAML stock class type.
 *
 * @param stockClassType - Native stock class type ('COMMON' | 'PREFERRED')
 * @returns DAML stock class type string literal
 * @throws OcpParseError if stockClassType is not a valid value
 */
export function stockClassTypeToDaml(stockClassType: StockClassType): DamlEnumConstructor<'OcfStockClassType'> {
  return toDaml('OcfStockClassType', stockClassType, 'stockClassType');
}

/**
 * Convert DAML stock class type to native OCF StockClassType.
 *
 * @param damlType - DAML stock class type string
 * @returns Native stock class type
 * @throws OcpParseError if damlType is not a valid value
 */
export function damlStockClassTypeToNative(damlType: string): StockClassType {
  return ocfEnumValue('OcfStockClassType', damlType, 'damlStockClassType');
}

// ===== Stakeholder Relationship Type Conversions =====

/**
 * DAML stakeholder relationship type enum values.
 */
export type DamlStakeholderRelationshipType = DamlEnumConstructor<'OcfStakeholderRelationshipType'>;

/** All canonical native relationship values, in OCF order. */
export const STAKEHOLDER_RELATIONSHIP_TYPES: readonly StakeholderRelationshipType[] = Object.freeze([
  ...OCF_ENUM_VALUES.OcfStakeholderRelationshipType,
]);

const STAKEHOLDER_RELATIONSHIP_TYPE_SET: ReadonlySet<string> = new Set(STAKEHOLDER_RELATIONSHIP_TYPES);

/** Runtime guard backed by the same OCF value list used for DAML encoding. */
export function isStakeholderRelationshipType(value: unknown): value is StakeholderRelationshipType {
  return typeof value === 'string' && STAKEHOLDER_RELATIONSHIP_TYPE_SET.has(value);
}

/**
 * Convert a native OCF stakeholder relationship type to DAML enum.
 *
 * @param relationship - Native relationship type
 * @returns DAML stakeholder relationship type enum value
 * @throws OcpParseError if relationship is not a valid value
 */
export function stakeholderRelationshipTypeToDaml(
  relationship: StakeholderRelationshipType
): DamlStakeholderRelationshipType {
  return toDaml('OcfStakeholderRelationshipType', relationship, 'stakeholderRelationshipType');
}

/**
 * Convert a DAML stakeholder relationship type to native OCF string.
 *
 * @param damlType - DAML stakeholder relationship type enum value
 * @returns Native relationship string
 * @throws OcpParseError if damlType is not a valid value
 */
export function damlStakeholderRelationshipToNative(
  damlType: DamlStakeholderRelationshipType
): StakeholderRelationshipType {
  return ocfEnumValue('OcfStakeholderRelationshipType', damlType, 'damlStakeholderRelationshipType');
}

// ===== Stakeholder Status Conversions =====

/**
 * DAML stakeholder status type.
 */
export type DamlStakeholderStatus = DamlEnumConstructor<'OcfStakeholderStatusType'>;

/**
 * Convert a native OCF stakeholder status to DAML enum.
 *
 * @param status - Native stakeholder status
 * @returns DAML stakeholder status enum value
 * @throws OcpParseError if status is not a valid value
 */
export function stakeholderStatusToDaml(status: StakeholderStatus): DamlStakeholderStatus {
  return toDaml('OcfStakeholderStatusType', status, 'stakeholderStatus');
}

/**
 * Convert a DAML stakeholder status to native OCF string.
 *
 * @param damlStatus - DAML stakeholder status enum value
 * @returns Native status string
 * @throws OcpParseError if damlStatus is not a valid value
 */
export function damlStakeholderStatusToNative(
  damlStatus: DamlStakeholderStatus,
  source = 'damlStakeholderStatus'
): StakeholderStatus {
  return ocfEnumValue('OcfStakeholderStatusType', damlStatus, source);
}
