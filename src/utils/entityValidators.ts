/**
 * Entity-specific validators for OCF types.
 *
 * These validators provide comprehensive input validation for common OCF entity types,
 * ensuring data integrity before sending to DAML contracts.
 *
 * @example
 *   ```typescript
 *   import { validateIssuerData, validateStakeholderData } from './entityValidators';
 *
 *   // Validates and throws OcpValidationError if invalid
 *   validateIssuerData(issuerData, 'issuer');
 *   validateStakeholderData(stakeholderData, 'stakeholder');
 *   ```
 */

import { OcpErrorCodes, OcpValidationError } from '../errors';
import type { Address, Email, Monetary, Phone } from '../types';
import {
  validateEnum,
  validateOptionalArray,
  validateOptionalDate,
  validateOptionalEnum,
  validateOptionalNumeric,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredDate,
  validateRequiredMonetary,
  validateRequiredNumeric,
  validateRequiredObject,
  validateRequiredString,
} from './validation';

// ===== Enum Constants =====

const EMAIL_TYPES = ['PERSONAL', 'BUSINESS', 'OTHER'] as const;
const PHONE_TYPES = ['HOME', 'MOBILE', 'BUSINESS', 'OTHER'] as const;
const ADDRESS_TYPES = ['LEGAL', 'CONTACT', 'OTHER'] as const;
const STAKEHOLDER_TYPES = ['INDIVIDUAL', 'INSTITUTION'] as const;
const STOCK_CLASS_TYPES = ['PREFERRED', 'COMMON'] as const;
const STOCK_ISSUANCE_TYPES = ['RSA', 'FOUNDERS_STOCK'] as const;
const VALUATION_TYPES = ['409A'] as const;
const STAKEHOLDER_STATUSES = [
  'ACTIVE',
  'LEAVE_OF_ABSENCE',
  'TERMINATION_VOLUNTARY_OTHER',
  'TERMINATION_VOLUNTARY_GOOD_CAUSE',
  'TERMINATION_VOLUNTARY_RETIREMENT',
  'TERMINATION_INVOLUNTARY_OTHER',
  'TERMINATION_INVOLUNTARY_DEATH',
  'TERMINATION_INVOLUNTARY_DISABILITY',
  'TERMINATION_INVOLUNTARY_WITH_CAUSE',
] as const;

const STAKEHOLDER_RELATIONSHIPS = [
  'EMPLOYEE',
  'ADVISOR',
  'INVESTOR',
  'FOUNDER',
  'BOARD_MEMBER',
  'OFFICER',
  'OTHER',
] as const;

// ===== Helper Validators =====

/**
 * Validate an initial_shares_authorized value.
 * Accepts numeric strings, "UNLIMITED", or "NOT_APPLICABLE".
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @param options - Whether the field is required (throws on null/undefined)
 */
function validateInitialSharesAuthorized(
  value: unknown,
  fieldPath: string,
  options: { required?: boolean } = {}
): void {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new OcpValidationError(fieldPath, 'Required field is missing', {
        expectedType: 'numeric string or "UNLIMITED"/"NOT_APPLICABLE"',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      });
    }
    return;
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Must be a string', {
      expectedType: 'numeric string or "UNLIMITED"/"NOT_APPLICABLE"',
      receivedValue: value,
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }
  if (!/^\d+(\.\d+)?$/.test(value) && value !== 'UNLIMITED' && value !== 'NOT_APPLICABLE') {
    throw new OcpValidationError(fieldPath, 'Must be a numeric string, "UNLIMITED", or "NOT_APPLICABLE"', {
      expectedType: 'numeric string or "UNLIMITED"/"NOT_APPLICABLE"',
      receivedValue: value,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }
}

/**
 * Validate an Email object.
 */
export function validateEmail(value: unknown, fieldPath: string): void {
  validateRequiredObject(value, fieldPath);
  const email = value;
  validateEnum(email.email_type, `${fieldPath}.email_type`, EMAIL_TYPES);
  validateRequiredString(email.email_address, `${fieldPath}.email_address`);
}

/**
 * Validate an optional Email object.
 */
export function validateOptionalEmail(value: unknown, fieldPath: string): Email | null {
  if (value === undefined || value === null) {
    return null;
  }
  validateEmail(value, fieldPath);
  return value as Email;
}

/**
 * Validate a Phone object.
 */
export function validatePhone(value: unknown, fieldPath: string): void {
  validateRequiredObject(value, fieldPath);
  const phone = value;
  validateEnum(phone.phone_type, `${fieldPath}.phone_type`, PHONE_TYPES);
  validateRequiredString(phone.phone_number, `${fieldPath}.phone_number`);
}

/**
 * Validate an optional Phone object.
 */
export function validateOptionalPhone(value: unknown, fieldPath: string): Phone | null {
  if (value === undefined || value === null) {
    return null;
  }
  validatePhone(value, fieldPath);
  return value as Phone;
}

/**
 * Validate an Address object.
 */
export function validateAddress(value: unknown, fieldPath: string): void {
  validateRequiredObject(value, fieldPath);
  const address = value;
  validateEnum(address.address_type, `${fieldPath}.address_type`, ADDRESS_TYPES);
  validateRequiredString(address.country, `${fieldPath}.country`);
  // Optional fields
  validateOptionalString(address.street_suite, `${fieldPath}.street_suite`);
  validateOptionalString(address.city, `${fieldPath}.city`);
  validateOptionalString(address.country_subdivision, `${fieldPath}.country_subdivision`);
  validateOptionalString(address.postal_code, `${fieldPath}.postal_code`);
}

/**
 * Validate an optional Address object.
 */
export function validateOptionalAddress(value: unknown, fieldPath: string): Address | null {
  if (value === undefined || value === null) {
    return null;
  }
  validateAddress(value, fieldPath);
  return value as Address;
}

/**
 * Validate a TaxId object.
 */
export function validateTaxId(value: unknown, fieldPath: string): void {
  validateRequiredObject(value, fieldPath);
  const taxId = value;
  validateRequiredString(taxId.country, `${fieldPath}.country`);
  validateRequiredString(taxId.tax_id, `${fieldPath}.tax_id`);
}

/**
 * Validate a Monetary object (entity-specific version).
 * Delegates to validateRequiredMonetary from validation.ts.
 */
export function validateMonetaryObject(value: unknown, fieldPath: string): void {
  validateRequiredMonetary(value, fieldPath);
}

/**
 * Validate an optional Monetary object.
 */
export function validateOptionalMonetaryObject(value: unknown, fieldPath: string): Monetary | null {
  if (value === undefined || value === null) {
    return null;
  }
  validateMonetaryObject(value, fieldPath);
  return value as Monetary;
}

/**
 * Validate a Name object.
 */
export function validateName(value: unknown, fieldPath: string): void {
  validateRequiredObject(value, fieldPath);
  const name = value;
  validateRequiredString(name.legal_name, `${fieldPath}.legal_name`);
  validateOptionalString(name.first_name, `${fieldPath}.first_name`);
  validateOptionalString(name.last_name, `${fieldPath}.last_name`);
}

/**
 * Validate the phone and email arrays in a contact info object.
 * This is a helper function used by both validateContactInfo and validateContactInfoWithoutName.
 */
function validateContactArrays(contact: Record<string, unknown>, fieldPath: string): void {
  // Validate optional phone_numbers array
  if (contact.phone_numbers !== undefined && contact.phone_numbers !== null) {
    if (!Array.isArray(contact.phone_numbers)) {
      throw new OcpValidationError(`${fieldPath}.phone_numbers`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: contact.phone_numbers,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    for (let i = 0; i < contact.phone_numbers.length; i++) {
      validatePhone(contact.phone_numbers[i], `${fieldPath}.phone_numbers[${i}]`);
    }
  }

  // Validate optional emails array
  if (contact.emails !== undefined && contact.emails !== null) {
    if (!Array.isArray(contact.emails)) {
      throw new OcpValidationError(`${fieldPath}.emails`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: contact.emails,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    for (let i = 0; i < contact.emails.length; i++) {
      validateEmail(contact.emails[i], `${fieldPath}.emails[${i}]`);
    }
  }
}

/**
 * Validate a ContactInfo object.
 */
export function validateContactInfo(value: unknown, fieldPath: string): void {
  validateRequiredObject(value, fieldPath);
  const contact = value;
  validateName(contact.name, `${fieldPath}.name`);
  validateContactArrays(contact, fieldPath);
}

/**
 * Validate a ContactInfoWithoutName object.
 */
export function validateContactInfoWithoutName(value: unknown, fieldPath: string): void {
  validateRequiredObject(value, fieldPath);
  const contact = value;
  validateContactArrays(contact, fieldPath);
}

// ===== Entity Validators =====

/**
 * Validate OcfIssuer data.
 *
 * Validates all required fields and structure of an issuer object.
 * Throws OcpValidationError with detailed field path on validation failure.
 *
 * @param data - The issuer data to validate
 * @param fieldPath - Base path for error messages (e.g., 'issuer')
 * @throws {OcpValidationError} if validation fails
 */
export function validateIssuerData(data: unknown, fieldPath: string): void {
  validateRequiredObject(data, fieldPath);
  const value = data;

  // Required fields
  validateRequiredString(value.id, `${fieldPath}.id`);
  validateRequiredString(value.legal_name, `${fieldPath}.legal_name`);
  validateRequiredDate(value.formation_date, `${fieldPath}.formation_date`);
  validateRequiredString(value.country_of_formation, `${fieldPath}.country_of_formation`);

  // Tax IDs - required array but can be empty
  if (!Array.isArray(value.tax_ids)) {
    throw new OcpValidationError(`${fieldPath}.tax_ids`, 'Must be an array', {
      expectedType: 'array',
      receivedValue: value.tax_ids,
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }
  const taxIds = value.tax_ids;
  for (let i = 0; i < taxIds.length; i++) {
    validateTaxId(taxIds[i], `${fieldPath}.tax_ids[${i}]`);
  }

  // Optional fields
  validateOptionalString(value.dba, `${fieldPath}.dba`);
  validateOptionalString(value.country_subdivision_of_formation, `${fieldPath}.country_subdivision_of_formation`);
  validateOptionalString(
    value.country_subdivision_name_of_formation,
    `${fieldPath}.country_subdivision_name_of_formation`
  );

  // Optional complex fields
  if (value.email !== undefined && value.email !== null) {
    validateEmail(value.email, `${fieldPath}.email`);
  }
  if (value.phone !== undefined && value.phone !== null) {
    validatePhone(value.phone, `${fieldPath}.phone`);
  }
  if (value.address !== undefined && value.address !== null) {
    validateAddress(value.address, `${fieldPath}.address`);
  }

  validateInitialSharesAuthorized(value.initial_shares_authorized, `${fieldPath}.initial_shares_authorized`);

  // Optional comments array
  validateOptionalArray(value.comments, `${fieldPath}.comments`);
}

/**
 * Validate OcfStakeholder data.
 *
 * Validates all required fields and structure of a stakeholder object.
 * Throws OcpValidationError with detailed field path on validation failure.
 *
 * @param data - The stakeholder data to validate
 * @param fieldPath - Base path for error messages (e.g., 'stakeholder')
 * @throws {OcpValidationError} if validation fails
 */
export function validateStakeholderData(data: unknown, fieldPath: string): void {
  validateRequiredObject(data, fieldPath);
  const value = data;

  // Required fields
  validateRequiredString(value.id, `${fieldPath}.id`);
  validateName(value.name, `${fieldPath}.name`);
  validateEnum(value.stakeholder_type, `${fieldPath}.stakeholder_type`, STAKEHOLDER_TYPES);

  // Optional fields
  validateOptionalString(value.issuer_assigned_id, `${fieldPath}.issuer_assigned_id`);
  validateOptionalEnum(value.current_relationship, `${fieldPath}.current_relationship`, STAKEHOLDER_RELATIONSHIPS);

  // Optional current_relationships array
  if (value.current_relationships !== undefined && value.current_relationships !== null) {
    if (!Array.isArray(value.current_relationships)) {
      throw new OcpValidationError(`${fieldPath}.current_relationships`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: value.current_relationships,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    const relationships = value.current_relationships;
    for (let i = 0; i < relationships.length; i++) {
      validateEnum(relationships[i], `${fieldPath}.current_relationships[${i}]`, STAKEHOLDER_RELATIONSHIPS);
    }
  }

  // Optional current_status
  validateOptionalEnum(value.current_status, `${fieldPath}.current_status`, STAKEHOLDER_STATUSES);

  // Optional primary_contact
  if (value.primary_contact !== undefined && value.primary_contact !== null) {
    validateContactInfo(value.primary_contact, `${fieldPath}.primary_contact`);
  }

  // Optional contact_info
  if (value.contact_info !== undefined && value.contact_info !== null) {
    validateContactInfoWithoutName(value.contact_info, `${fieldPath}.contact_info`);
  }

  // Optional addresses array
  if (value.addresses !== undefined && value.addresses !== null) {
    if (!Array.isArray(value.addresses)) {
      throw new OcpValidationError(`${fieldPath}.addresses`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: value.addresses,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    for (let i = 0; i < value.addresses.length; i++) {
      validateAddress(value.addresses[i], `${fieldPath}.addresses[${i}]`);
    }
  }

  // Optional tax_ids array
  if (value.tax_ids !== undefined && value.tax_ids !== null) {
    if (!Array.isArray(value.tax_ids)) {
      throw new OcpValidationError(`${fieldPath}.tax_ids`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: value.tax_ids,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    const stakeholderTaxIds = value.tax_ids;
    for (let i = 0; i < stakeholderTaxIds.length; i++) {
      validateTaxId(stakeholderTaxIds[i], `${fieldPath}.tax_ids[${i}]`);
    }
  }

  // Optional comments array
  validateOptionalArray(value.comments, `${fieldPath}.comments`);
}

/**
 * Validate OcfStockClass data.
 *
 * Validates all required fields and structure of a stock class object.
 * Throws OcpValidationError with detailed field path on validation failure.
 *
 * @param data - The stock class data to validate
 * @param fieldPath - Base path for error messages (e.g., 'stockClass')
 * @throws {OcpValidationError} if validation fails
 */
export function validateStockClassData(data: unknown, fieldPath: string): void {
  validateRequiredObject(data, fieldPath);
  const value = data;

  // Required fields
  validateRequiredString(value.id, `${fieldPath}.id`);
  validateRequiredString(value.name, `${fieldPath}.name`);
  validateEnum(value.class_type, `${fieldPath}.class_type`, STOCK_CLASS_TYPES);
  validateRequiredString(value.default_id_prefix, `${fieldPath}.default_id_prefix`);

  validateInitialSharesAuthorized(value.initial_shares_authorized, `${fieldPath}.initial_shares_authorized`, {
    required: true,
  });

  validateRequiredNumeric(value.seniority, `${fieldPath}.seniority`);
  validateRequiredNumeric(value.votes_per_share, `${fieldPath}.votes_per_share`);

  // Optional fields
  validateOptionalDate(value.board_approval_date, `${fieldPath}.board_approval_date`);
  validateOptionalDate(value.stockholder_approval_date, `${fieldPath}.stockholder_approval_date`);
  validateOptionalNumeric(value.liquidation_preference_multiple, `${fieldPath}.liquidation_preference_multiple`);
  validateOptionalNumeric(value.participation_cap_multiple, `${fieldPath}.participation_cap_multiple`);

  // Optional monetary fields
  if (value.par_value !== undefined && value.par_value !== null) {
    validateMonetaryObject(value.par_value, `${fieldPath}.par_value`);
  }
  if (value.price_per_share !== undefined && value.price_per_share !== null) {
    validateMonetaryObject(value.price_per_share, `${fieldPath}.price_per_share`);
  }

  // Optional conversion_rights array - complex validation
  if (value.conversion_rights !== undefined && value.conversion_rights !== null) {
    if (!Array.isArray(value.conversion_rights)) {
      throw new OcpValidationError(`${fieldPath}.conversion_rights`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: value.conversion_rights,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    // Each conversion right has complex structure - basic validation
    const conversionRights = value.conversion_rights;
    for (let i = 0; i < conversionRights.length; i++) {
      const right = conversionRights[i];
      validateRequiredObject(right, `${fieldPath}.conversion_rights[${i}]`);
      validateRequiredString(
        right.converts_to_stock_class_id,
        `${fieldPath}.conversion_rights[${i}].converts_to_stock_class_id`
      );
    }
  }

  // Optional comments array
  validateOptionalArray(value.comments, `${fieldPath}.comments`);
}

/**
 * Validate OcfStockIssuance data.
 *
 * Validates all required fields and structure of a stock issuance object.
 * Throws OcpValidationError with detailed field path on validation failure.
 *
 * @param data - The stock issuance data to validate
 * @param fieldPath - Base path for error messages (e.g., 'stockIssuance')
 * @throws {OcpValidationError} if validation fails
 */
export function validateStockIssuanceData(data: unknown, fieldPath: string): void {
  validateRequiredObject(data, fieldPath);
  const value = data;

  // Required fields
  validateRequiredString(value.id, `${fieldPath}.id`);
  validateRequiredDate(value.date, `${fieldPath}.date`);
  validateRequiredString(value.security_id, `${fieldPath}.security_id`);
  validateRequiredString(value.custom_id, `${fieldPath}.custom_id`);
  validateRequiredString(value.stakeholder_id, `${fieldPath}.stakeholder_id`);
  validateRequiredString(value.stock_class_id, `${fieldPath}.stock_class_id`);
  validateMonetaryObject(value.share_price, `${fieldPath}.share_price`);
  validateRequiredNumeric(value.quantity, `${fieldPath}.quantity`);

  // Optional fields
  validateOptionalDate(value.board_approval_date, `${fieldPath}.board_approval_date`);
  validateOptionalDate(value.stockholder_approval_date, `${fieldPath}.stockholder_approval_date`);
  validateOptionalString(value.consideration_text, `${fieldPath}.consideration_text`);
  validateOptionalString(value.stock_plan_id, `${fieldPath}.stock_plan_id`);
  validateOptionalString(value.vesting_terms_id, `${fieldPath}.vesting_terms_id`);
  validateOptionalEnum(value.issuance_type, `${fieldPath}.issuance_type`, STOCK_ISSUANCE_TYPES);

  // Optional security_law_exemptions array
  if (value.security_law_exemptions !== undefined && value.security_law_exemptions !== null) {
    if (!Array.isArray(value.security_law_exemptions)) {
      throw new OcpValidationError(`${fieldPath}.security_law_exemptions`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: value.security_law_exemptions,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    const exemptions = value.security_law_exemptions;
    for (let i = 0; i < exemptions.length; i++) {
      const exemption = exemptions[i];
      validateRequiredObject(exemption, `${fieldPath}.security_law_exemptions[${i}]`);
      validateRequiredString(exemption.description, `${fieldPath}.security_law_exemptions[${i}].description`);
      validateRequiredString(exemption.jurisdiction, `${fieldPath}.security_law_exemptions[${i}].jurisdiction`);
    }
  }

  // Optional share_numbers_issued array
  if (value.share_numbers_issued !== undefined && value.share_numbers_issued !== null) {
    if (!Array.isArray(value.share_numbers_issued)) {
      throw new OcpValidationError(`${fieldPath}.share_numbers_issued`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: value.share_numbers_issued,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    const shareRanges = value.share_numbers_issued;
    for (let i = 0; i < shareRanges.length; i++) {
      const range = shareRanges[i];
      validateRequiredObject(range, `${fieldPath}.share_numbers_issued[${i}]`);
      validateRequiredNumeric(
        range.starting_share_number,
        `${fieldPath}.share_numbers_issued[${i}].starting_share_number`
      );
      validateRequiredNumeric(range.ending_share_number, `${fieldPath}.share_numbers_issued[${i}].ending_share_number`);
    }
  }

  // Optional vestings array
  if (value.vestings !== undefined && value.vestings !== null) {
    if (!Array.isArray(value.vestings)) {
      throw new OcpValidationError(`${fieldPath}.vestings`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: value.vestings,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    for (let i = 0; i < value.vestings.length; i++) {
      const vesting = value.vestings[i];
      validateRequiredObject(vesting, `${fieldPath}.vestings[${i}]`);
      validateRequiredDate(vesting.date, `${fieldPath}.vestings[${i}].date`);
      validateRequiredNumeric(vesting.amount, `${fieldPath}.vestings[${i}].amount`);
    }
  }

  // Optional cost_basis
  if (value.cost_basis !== undefined && value.cost_basis !== null) {
    validateMonetaryObject(value.cost_basis, `${fieldPath}.cost_basis`);
  }

  // Optional stock_legend_ids array
  validateOptionalArray(value.stock_legend_ids, `${fieldPath}.stock_legend_ids`);

  // Optional comments array
  validateOptionalArray(value.comments, `${fieldPath}.comments`);
}

/**
 * Validate OcfValuation data.
 *
 * Validates all required fields and structure of a valuation object.
 * Throws OcpValidationError with detailed field path on validation failure.
 *
 * @param data - The valuation data to validate
 * @param fieldPath - Base path for error messages (e.g., 'valuation')
 * @throws {OcpValidationError} if validation fails
 */
export function validateValuationData(data: unknown, fieldPath: string): void {
  validateRequiredObject(data, fieldPath);
  const value = data;

  // Required fields
  validateRequiredString(value.id, `${fieldPath}.id`);
  validateRequiredString(value.stock_class_id, `${fieldPath}.stock_class_id`);
  validateRequiredDate(value.effective_date, `${fieldPath}.effective_date`);
  validateEnum(value.valuation_type, `${fieldPath}.valuation_type`, VALUATION_TYPES);
  validateMonetaryObject(value.price_per_share, `${fieldPath}.price_per_share`);

  // Optional fields
  validateOptionalString(value.provider, `${fieldPath}.provider`);
  validateOptionalDate(value.board_approval_date, `${fieldPath}.board_approval_date`);
  validateOptionalDate(value.stockholder_approval_date, `${fieldPath}.stockholder_approval_date`);

  // Optional comments array
  validateOptionalArray(value.comments, `${fieldPath}.comments`);
}

/**
 * Validate OcfDocument data.
 *
 * Validates all required fields and structure of a document object.
 * Throws OcpValidationError with detailed field path on validation failure.
 *
 * @param data - The document data to validate
 * @param fieldPath - Base path for error messages (e.g., 'document')
 * @throws {OcpValidationError} if validation fails
 */
export function validateDocumentData(data: unknown, fieldPath: string): void {
  validateRequiredObject(data, fieldPath);
  const value = data;

  // Required fields
  validateRequiredString(value.id, `${fieldPath}.id`);
  validateRequiredString(value.md5, `${fieldPath}.md5`);

  // Must have either path or uri
  const hasPath = value.path !== undefined && value.path !== null && value.path !== '';
  const hasUri = value.uri !== undefined && value.uri !== null && value.uri !== '';

  if (!hasPath && !hasUri) {
    throw new OcpValidationError(`${fieldPath}`, 'Document must have either path or uri', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }

  // Optional fields
  validateOptionalString(value.path, `${fieldPath}.path`);
  validateOptionalString(value.uri, `${fieldPath}.uri`);

  // Optional related_objects array
  if (value.related_objects !== undefined && value.related_objects !== null) {
    if (!Array.isArray(value.related_objects)) {
      throw new OcpValidationError(`${fieldPath}.related_objects`, 'Must be an array if provided', {
        expectedType: 'array',
        receivedValue: value.related_objects,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    const relatedObjects = value.related_objects;
    for (let i = 0; i < relatedObjects.length; i++) {
      const ref = relatedObjects[i];
      validateRequiredObject(ref, `${fieldPath}.related_objects[${i}]`);
      validateRequiredString(ref.object_type, `${fieldPath}.related_objects[${i}].object_type`);
      validateRequiredString(ref.object_id, `${fieldPath}.related_objects[${i}].object_id`);
    }
  }

  // Optional comments array
  validateOptionalArray(value.comments, `${fieldPath}.comments`);
}

// ===== Transaction Validators =====

/**
 * Validate common transaction fields.
 * This is a helper function for transaction-specific validators.
 */
export function validateTransactionBase(
  value: Record<string, unknown>,
  path: string,
  options: { requireSecurityId?: boolean; requireQuantity?: boolean } = {}
): void {
  validateRequiredString(value.id, `${path}.id`);
  validateRequiredDate(value.date, `${path}.date`);

  if (options.requireSecurityId !== false) {
    validateRequiredString(value.security_id, `${path}.security_id`);
  }

  if (options.requireQuantity) {
    validateRequiredNumeric(value.quantity, `${path}.quantity`);
  }

  validateOptionalArray(value.comments, `${path}.comments`);
}

/**
 * Validate resulting_security_ids array (must be non-empty for certain transactions).
 */
export function validateResultingSecurityIds(value: unknown, fieldPath: string): void {
  validateRequiredArray(value, fieldPath);
  const ids = value;
  for (let i = 0; i < ids.length; i++) {
    validateRequiredString(ids[i], `${fieldPath}[${i}]`);
  }
}
