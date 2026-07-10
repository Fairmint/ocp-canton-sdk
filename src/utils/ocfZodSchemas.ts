import type { ErrorObject, ValidateFunction } from 'ajv';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { z, ZodError, type ZodType } from 'zod';
import { OcpErrorCodes, OcpValidationError } from '../errors';
import {
  ENTITY_OBJECT_TYPE_MAP,
  type OcfDataTypeFor,
  type OcfEntityType,
} from '../functions/OpenCapTable/capTable/batchTypes';
import { normalizeOcfData } from './planSecurityAliases';

/**
 * Canonical source-of-truth OCF object schema paths.
 *
 * Paths are relative to `<OCF_SCHEMA_DIR>/objects`.
 * Source: https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/tree/main/schema
 */
export const OCF_OBJECT_SCHEMA_PATHS = {
  // Core objects
  ISSUER: 'Issuer.schema.json',
  STAKEHOLDER: 'Stakeholder.schema.json',
  STOCK_CLASS: 'StockClass.schema.json',
  STOCK_LEGEND_TEMPLATE: 'StockLegendTemplate.schema.json',
  STOCK_PLAN: 'StockPlan.schema.json',
  VALUATION: 'Valuation.schema.json',
  VESTING_TERMS: 'VestingTerms.schema.json',
  FINANCING: 'Financing.schema.json',
  DOCUMENT: 'Document.schema.json',

  // Stakeholder change events
  CE_STAKEHOLDER_RELATIONSHIP: 'transactions/change_event/StakeholderRelationshipChangeEvent.schema.json',
  CE_STAKEHOLDER_STATUS: 'transactions/change_event/StakeholderStatusChangeEvent.schema.json',

  // Adjustments
  TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: 'transactions/adjustment/IssuerAuthorizedSharesAdjustment.schema.json',
  TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT: 'transactions/adjustment/StockClassConversionRatioAdjustment.schema.json',
  TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT:
    'transactions/adjustment/StockClassAuthorizedSharesAdjustment.schema.json',
  TX_STOCK_CLASS_SPLIT: 'transactions/split/StockClassSplit.schema.json',
  TX_STOCK_PLAN_POOL_ADJUSTMENT: 'transactions/adjustment/StockPlanPoolAdjustment.schema.json',
  TX_STOCK_PLAN_RETURN_TO_POOL: 'transactions/return_to_pool/StockPlanReturnToPool.schema.json',

  // Convertibles
  TX_CONVERTIBLE_ACCEPTANCE: 'transactions/acceptance/ConvertibleAcceptance.schema.json',
  TX_CONVERTIBLE_CANCELLATION: 'transactions/cancellation/ConvertibleCancellation.schema.json',
  TX_CONVERTIBLE_CONVERSION: 'transactions/conversion/ConvertibleConversion.schema.json',
  TX_CONVERTIBLE_ISSUANCE: 'transactions/issuance/ConvertibleIssuance.schema.json',
  TX_CONVERTIBLE_RETRACTION: 'transactions/retraction/ConvertibleRetraction.schema.json',
  TX_CONVERTIBLE_TRANSFER: 'transactions/transfer/ConvertibleTransfer.schema.json',

  // Equity compensation
  TX_EQUITY_COMPENSATION_ACCEPTANCE: 'transactions/acceptance/EquityCompensationAcceptance.schema.json',
  TX_EQUITY_COMPENSATION_CANCELLATION: 'transactions/cancellation/EquityCompensationCancellation.schema.json',
  TX_EQUITY_COMPENSATION_EXERCISE: 'transactions/exercise/EquityCompensationExercise.schema.json',
  TX_EQUITY_COMPENSATION_ISSUANCE: 'transactions/issuance/EquityCompensationIssuance.schema.json',
  TX_EQUITY_COMPENSATION_RELEASE: 'transactions/release/EquityCompensationRelease.schema.json',
  TX_EQUITY_COMPENSATION_RETRACTION: 'transactions/retraction/EquityCompensationRetraction.schema.json',
  TX_EQUITY_COMPENSATION_TRANSFER: 'transactions/transfer/EquityCompensationTransfer.schema.json',
  TX_EQUITY_COMPENSATION_REPRICING: 'transactions/repricing/EquityCompensationRepricing.schema.json',

  // PlanSecurity compatibility wrappers
  TX_PLAN_SECURITY_ACCEPTANCE: 'transactions/acceptance/PlanSecurityAcceptance.schema.json',
  TX_PLAN_SECURITY_CANCELLATION: 'transactions/cancellation/PlanSecurityCancellation.schema.json',
  TX_PLAN_SECURITY_EXERCISE: 'transactions/exercise/PlanSecurityExercise.schema.json',
  TX_PLAN_SECURITY_ISSUANCE: 'transactions/issuance/PlanSecurityIssuance.schema.json',
  TX_PLAN_SECURITY_RELEASE: 'transactions/release/PlanSecurityRelease.schema.json',
  TX_PLAN_SECURITY_RETRACTION: 'transactions/retraction/PlanSecurityRetraction.schema.json',
  TX_PLAN_SECURITY_TRANSFER: 'transactions/transfer/PlanSecurityTransfer.schema.json',

  // Stock
  TX_STOCK_ACCEPTANCE: 'transactions/acceptance/StockAcceptance.schema.json',
  TX_STOCK_CANCELLATION: 'transactions/cancellation/StockCancellation.schema.json',
  TX_STOCK_CONVERSION: 'transactions/conversion/StockConversion.schema.json',
  TX_STOCK_ISSUANCE: 'transactions/issuance/StockIssuance.schema.json',
  TX_STOCK_REISSUANCE: 'transactions/reissuance/StockReissuance.schema.json',
  TX_STOCK_CONSOLIDATION: 'transactions/consolidation/StockConsolidation.schema.json',
  TX_STOCK_REPURCHASE: 'transactions/repurchase/StockRepurchase.schema.json',
  TX_STOCK_RETRACTION: 'transactions/retraction/StockRetraction.schema.json',
  TX_STOCK_TRANSFER: 'transactions/transfer/StockTransfer.schema.json',

  // Warrants
  TX_WARRANT_ACCEPTANCE: 'transactions/acceptance/WarrantAcceptance.schema.json',
  TX_WARRANT_CANCELLATION: 'transactions/cancellation/WarrantCancellation.schema.json',
  TX_WARRANT_EXERCISE: 'transactions/exercise/WarrantExercise.schema.json',
  TX_WARRANT_ISSUANCE: 'transactions/issuance/WarrantIssuance.schema.json',
  TX_WARRANT_RETRACTION: 'transactions/retraction/WarrantRetraction.schema.json',
  TX_WARRANT_TRANSFER: 'transactions/transfer/WarrantTransfer.schema.json',

  // Vesting
  TX_VESTING_ACCELERATION: 'transactions/vesting/VestingAcceleration.schema.json',
  TX_VESTING_START: 'transactions/vesting/VestingStart.schema.json',
  TX_VESTING_EVENT: 'transactions/vesting/VestingEvent.schema.json',
} as const;

export type OcfSchemaObjectType = keyof typeof OCF_OBJECT_SCHEMA_PATHS;

/**
 * Legacy object_type aliases accepted as input and normalized to canonical schema keys.
 */
const LEGACY_OBJECT_TYPE_ALIASES: Partial<Record<string, OcfSchemaObjectType>> = {
  TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT: 'CE_STAKEHOLDER_RELATIONSHIP',
  TX_STAKEHOLDER_STATUS_CHANGE_EVENT: 'CE_STAKEHOLDER_STATUS',
};

const OBJECTS_DIR_RELATIVE_PATH = 'objects';
const SCHEMA_FILE_SUFFIX = '.schema.json';
const PACKAGED_SCHEMA_DIR_RELATIVE_PATH = '../ocf-schema';
const SUBMODULE_SCHEMA_DIR_RELATIVE_PATH = '../../libs/Open-Cap-Format-OCF/schema';
const REPO_SCHEMA_DIR_RELATIVE_PATH = '../../Open-Cap-Format-OCF/schema';

let cachedAjv: Ajv | null = null;
let cachedSchemaRootDir: string | null = null;

const validatorCache = new Map<OcfSchemaObjectType, ValidateFunction>();
const zodSchemaCache = new Map<string, ZodType<Record<string, unknown>>>();

/**
 * Resolve the local OCF schema directory.
 */
export function resolveOcfSchemaDir(): string {
  const packagedSchemaDir = path.resolve(__dirname, PACKAGED_SCHEMA_DIR_RELATIVE_PATH);
  const submoduleSchemaDir = path.resolve(__dirname, SUBMODULE_SCHEMA_DIR_RELATIVE_PATH);
  const repoSchemaDir = path.resolve(__dirname, REPO_SCHEMA_DIR_RELATIVE_PATH);
  const candidates = [process.env.OCP_OCF_SCHEMA_DIR, packagedSchemaDir, submoduleSchemaDir, repoSchemaDir].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0
  );

  for (const candidate of candidates) {
    const objectsDir = path.join(candidate, OBJECTS_DIR_RELATIVE_PATH);
    if (fs.existsSync(objectsDir)) {
      return candidate;
    }
  }

  throw new OcpValidationError(
    'ocfSchemaDir',
    `OCF schema directory not found. Set OCP_OCF_SCHEMA_DIR or initialize the OCF submodule with ` +
      `"git submodule update --init --recursive libs/Open-Cap-Format-OCF" ` +
      `(or "git submodule update --init --recursive Open-Cap-Format-OCF" for root-level checkouts).`,
    {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'existing directory containing schema/objects/*.schema.json',
      receivedValue: candidates,
    }
  );
}

function listSchemaFilesRecursively(directory: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSchemaFilesRecursively(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(SCHEMA_FILE_SUFFIX)) {
      results.push(fullPath);
    }
  }

  return results;
}

function readJsonFile(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new OcpValidationError('schemaFile', `Schema file is not a JSON object: ${filePath}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: parsed,
    });
  }
  return parsed as Record<string, unknown>;
}

function ensureAjvInitialized(): { ajv: Ajv; schemaRootDir: string } {
  if (cachedAjv && cachedSchemaRootDir) {
    return { ajv: cachedAjv, schemaRootDir: cachedSchemaRootDir };
  }

  const schemaRootDir = resolveOcfSchemaDir();
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: true,
  });
  addFormats(ajv);

  const schemaFiles = listSchemaFilesRecursively(schemaRootDir);
  for (const schemaFile of schemaFiles) {
    const schema = readJsonFile(schemaFile);
    const schemaId = schema.$id;
    if (typeof schemaId === 'string' && schemaId.length > 0) {
      ajv.addSchema(schema, schemaId);
    }
  }

  cachedAjv = ajv;
  cachedSchemaRootDir = schemaRootDir;
  return { ajv, schemaRootDir };
}

function resolveSchemaObjectType(objectType: string): OcfSchemaObjectType {
  if (Object.prototype.hasOwnProperty.call(OCF_OBJECT_SCHEMA_PATHS, objectType)) {
    return objectType as OcfSchemaObjectType;
  }

  const alias = LEGACY_OBJECT_TYPE_ALIASES[objectType];
  if (alias) {
    return alias;
  }

  throw new OcpValidationError('object_type', `Unsupported OCF object_type: ${objectType}`, {
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    expectedType: Object.keys(OCF_OBJECT_SCHEMA_PATHS).join(' | '),
    receivedValue: objectType,
  });
}

function getAjvValidator(objectType: OcfSchemaObjectType): ValidateFunction {
  const cached = validatorCache.get(objectType);
  if (cached) {
    return cached;
  }

  const { ajv, schemaRootDir } = ensureAjvInitialized();
  const relativeSchemaPath = OCF_OBJECT_SCHEMA_PATHS[objectType];
  const schemaPath = path.join(schemaRootDir, OBJECTS_DIR_RELATIVE_PATH, relativeSchemaPath);
  if (!fs.existsSync(schemaPath)) {
    throw new OcpValidationError('schemaPath', `Schema file not found for object_type ${objectType}`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: schemaPath,
    });
  }

  const schema = readJsonFile(schemaPath);
  const schemaId = schema.$id;
  let validator: ValidateFunction | undefined;

  if (typeof schemaId === 'string' && schemaId.length > 0) {
    validator = ajv.getSchema(schemaId);
  }

  validator ??= ajv.compile(schema);

  validatorCache.set(objectType, validator);
  return validator;
}

function jsonPointerToPath(pointer: string): Array<string | number> {
  if (!pointer || pointer === '/') return [];
  return pointer
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment))
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

function ajvErrorToPath(error: ErrorObject): Array<string | number> {
  const pathFromPointer = jsonPointerToPath(error.instancePath);
  if (error.keyword === 'required' && 'missingProperty' in error.params) {
    const { missingProperty } = error.params as { missingProperty: unknown };
    if (typeof missingProperty === 'string' && missingProperty.length > 0) {
      return [...pathFromPointer, missingProperty];
    }
  }
  return pathFromPointer;
}

function formatAjvError(error: ErrorObject): string {
  const instancePath = error.instancePath && error.instancePath.length > 0 ? error.instancePath : '/';
  const message = error.message ?? 'schema validation failed';
  const params = JSON.stringify(error.params);
  return `${instancePath}: ${message} ${params}`;
}

function convertZodErrorToValidationError(error: ZodError, contextField: string): OcpValidationError {
  if (error.issues.length === 0) {
    return new OcpValidationError(contextField, 'OCF schema validation failed', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: error.issues,
    });
  }

  const [firstIssue] = error.issues;
  if (firstIssue === undefined) {
    return new OcpValidationError(contextField, 'OCF schema validation failed', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: error.issues,
    });
  }
  const firstIssuePath = firstIssue.path.join('.');
  const issuePath = firstIssuePath.length > 0 ? firstIssuePath : contextField;
  const issueMessage = error.issues
    .map((issue) => {
      const issuePathValue = issue.path.join('.');
      const formattedIssuePath = issuePathValue.length > 0 ? issuePathValue : contextField;
      return `[${formattedIssuePath}] ${issue.message}`;
    })
    .join('; ');

  const finalIssueMessage = issueMessage.length > 0 ? issueMessage : 'OCF schema validation failed';
  return new OcpValidationError(issuePath, finalIssueMessage, {
    code: OcpErrorCodes.INVALID_FORMAT,
    receivedValue: error.issues,
  });
}

function createSchemaForObjectType(objectType: OcfSchemaObjectType): ZodType<Record<string, unknown>> {
  const validator = getAjvValidator(objectType);
  return z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
    const valid = validator(value);
    if (!valid) {
      const errors = validator.errors ?? [];
      for (const error of errors) {
        ctx.addIssue({
          code: 'custom',
          path: ajvErrorToPath(error),
          message: formatAjvError(error),
        });
      }
      return;
    }

    addCanonicalConversionIssues(value, ctx, objectType);
  });
}

const CONVERSION_RIGHT_MECHANISMS = {
  CONVERTIBLE_CONVERSION_RIGHT: new Set([
    'SAFE_CONVERSION',
    'CONVERTIBLE_NOTE_CONVERSION',
    'CUSTOM_CONVERSION',
    'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
    'FIXED_AMOUNT_CONVERSION',
  ]),
  WARRANT_CONVERSION_RIGHT: new Set([
    'CUSTOM_CONVERSION',
    'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
    'FIXED_AMOUNT_CONVERSION',
    'VALUATION_BASED_CONVERSION',
    'PPS_BASED_CONVERSION',
  ]),
  STOCK_CLASS_CONVERSION_RIGHT: new Set(['RATIO_CONVERSION']),
} as const;

type CanonicalConversionRightType = keyof typeof CONVERSION_RIGHT_MECHANISMS;

function isCanonicalConversionRightType(value: string): value is CanonicalConversionRightType {
  return Object.prototype.hasOwnProperty.call(CONVERSION_RIGHT_MECHANISMS, value);
}

function addCanonicalConversionIssues(
  value: unknown,
  ctx: { addIssue(issue: { code: 'custom'; path: Array<string | number>; message: string }): void },
  objectType: OcfSchemaObjectType,
  segments: Array<string | number> = []
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => addCanonicalConversionIssues(item, ctx, objectType, [...segments, index]));
    return;
  }
  if (!isRecord(value)) return;

  if ('conversion_mechanism' in value) {
    const rightType = value.type;
    if (typeof rightType !== 'string' || !isCanonicalConversionRightType(rightType)) {
      ctx.addIssue({
        code: 'custom',
        path: [...segments, 'type'],
        message: 'A conversion right requires its exact type discriminator',
      });
    } else {
      const rightAllowedByObject =
        objectType !== 'TX_CONVERTIBLE_ISSUANCE' || rightType === 'CONVERTIBLE_CONVERSION_RIGHT';
      const rightAllowedByWarrant =
        objectType !== 'TX_WARRANT_ISSUANCE' ||
        rightType === 'WARRANT_CONVERSION_RIGHT' ||
        rightType === 'STOCK_CLASS_CONVERSION_RIGHT';
      if (!rightAllowedByObject || !rightAllowedByWarrant) {
        ctx.addIssue({
          code: 'custom',
          path: [...segments, 'type'],
          message: `${objectType} does not permit conversion right ${rightType}`,
        });
      }
      const mechanism = value.conversion_mechanism;
      const mechanismType = isRecord(mechanism) ? mechanism.type : undefined;
      const allowed = CONVERSION_RIGHT_MECHANISMS[rightType];
      if (typeof mechanismType !== 'string' || !allowed.has(mechanismType)) {
        ctx.addIssue({
          code: 'custom',
          path: [...segments, 'conversion_mechanism', 'type'],
          message: `${rightType} does not permit conversion mechanism ${String(mechanismType)}`,
        });
      }
    }
  }

  if (value.type === 'PPS_BASED_CONVERSION') {
    const hasPercentage = value.discount_percentage !== undefined;
    const hasAmount = value.discount_amount !== undefined;
    if (typeof value.discount !== 'boolean') {
      ctx.addIssue({
        code: 'custom',
        path: [...segments, 'discount'],
        message: 'PPS_BASED_CONVERSION requires a boolean discount field',
      });
    } else if (value.discount && hasPercentage === hasAmount) {
      ctx.addIssue({
        code: 'custom',
        path: [...segments, 'discount'],
        message: 'A discounted PPS conversion requires exactly one discount detail',
      });
    } else if (!value.discount && (hasPercentage || hasAmount)) {
      ctx.addIssue({
        code: 'custom',
        path: [...segments, 'discount'],
        message: 'A non-discounted PPS conversion cannot include discount details',
      });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    addCanonicalConversionIssues(child, ctx, objectType, [...segments, key]);
  }
}

/**
 * Get strict Zod schema for an OCF object type.
 */
export function getOcfSchema(objectType: string): ZodType<Record<string, unknown>> {
  const resolvedObjectType = resolveSchemaObjectType(objectType);
  const cached = zodSchemaCache.get(resolvedObjectType);
  if (cached) {
    return cached;
  }

  const schema = createSchemaForObjectType(resolvedObjectType);
  zodSchemaCache.set(resolvedObjectType, schema);
  return schema;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isParsedEntityType<T extends OcfEntityType>(
  value: Record<string, unknown>,
  expectedObjectType: string
): value is OcfDataTypeFor<T> & Record<string, unknown> {
  return value.object_type === expectedObjectType;
}

function hasPresentField(value: Record<string, unknown>, field: string): boolean {
  return value[field] !== undefined && value[field] !== null;
}

/** Enforce canonical SDK invariants that are stricter than compatibility-oriented OCF schemas. */
function validateCanonicalSemanticRefinements(value: Record<string, unknown>): void {
  if (value.object_type !== 'TX_EQUITY_COMPENSATION_ISSUANCE') return;

  const compensationType = value.compensation_type;
  const hasExercisePrice = hasPresentField(value, 'exercise_price');
  const hasBasePrice = hasPresentField(value, 'base_price');

  if (compensationType === 'OPTION' || compensationType === 'OPTION_ISO' || compensationType === 'OPTION_NSO') {
    if (!hasExercisePrice) {
      throw new OcpValidationError('exercise_price', `exercise_price is required for ${compensationType}`, {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'Monetary',
      });
    }
    if (hasBasePrice) {
      throw new OcpValidationError('base_price', `base_price is not valid for ${compensationType}`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'absent',
        receivedValue: value.base_price,
      });
    }
    return;
  }

  if (compensationType === 'CSAR' || compensationType === 'SSAR') {
    if (!hasBasePrice) {
      throw new OcpValidationError('base_price', `base_price is required for ${compensationType}`, {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'Monetary',
      });
    }
    if (hasExercisePrice) {
      throw new OcpValidationError('exercise_price', `exercise_price is not valid for ${compensationType}`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'absent',
        receivedValue: value.exercise_price,
      });
    }
    return;
  }

  if (compensationType === 'RSU' && (hasExercisePrice || hasBasePrice)) {
    const invalidField = hasExercisePrice ? 'exercise_price' : 'base_price';
    throw new OcpValidationError(invalidField, `${invalidField} is not valid for RSU`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'absent',
      receivedValue: value[invalidField],
    });
  }
}

/**
 * Parse and validate an arbitrary OCF JSON object.
 *
 * Deprecated/legacy aliases are normalized to canonical latest forms prior to strict validation.
 */
export function parseOcfObject(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) {
    throw new OcpValidationError('ocfObject', 'Expected a JSON object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Record<string, unknown>',
      receivedValue: input,
    });
  }

  let normalized: Record<string, unknown>;
  try {
    normalized = normalizeOcfData(input);
  } catch (error) {
    if (error instanceof OcpValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Failed to normalize OCF data';
    throw new OcpValidationError('ocfObject', message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: input,
    });
  }
  const objectType = normalized.object_type;
  if (typeof objectType !== 'string' || objectType.length === 0) {
    throw new OcpValidationError('object_type', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: objectType,
    });
  }

  const schema = getOcfSchema(objectType);
  try {
    validateCanonicalSemanticRefinements(normalized);
    const parsed = schema.parse(normalized);
    return parsed;
  } catch (error) {
    if (error instanceof ZodError) {
      throw convertZodErrorToValidationError(error, 'ocfObject');
    }
    throw error;
  }
}

/**
 * Parse and validate OCF input for a specific SDK entity type.
 *
 * Typed SDK inputs must provide the exact canonical object_type for the entity.
 * Legacy aliases remain supported only by the raw {@link parseOcfObject} ingestion boundary.
 */
export function parseOcfEntityInput<T extends OcfEntityType>(entityType: T, input: unknown): OcfDataTypeFor<T> {
  if (!isRecord(input)) {
    throw new OcpValidationError(`${entityType}`, 'Expected a JSON object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Record<string, unknown>',
      receivedValue: input,
    });
  }

  const expectedObjectType = resolveSchemaObjectType(ENTITY_OBJECT_TYPE_MAP[entityType]);
  const objectInput = input;
  const receivedObjectType = objectInput.object_type;
  if (typeof receivedObjectType !== 'string' || receivedObjectType.length === 0) {
    throw new OcpValidationError('object_type', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: expectedObjectType,
      receivedValue: receivedObjectType,
    });
  }
  if (receivedObjectType !== expectedObjectType) {
    throw new OcpValidationError(
      'object_type',
      `Entity type "${entityType}" expects object_type "${expectedObjectType}", received "${receivedObjectType}"`,
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: expectedObjectType,
        receivedValue: receivedObjectType,
      }
    );
  }

  const parsed = parseOcfObject(objectInput);
  if (!isParsedEntityType<T>(parsed, expectedObjectType)) {
    const parsedObjectType = parsed.object_type;
    const receivedObjectTypeMessage =
      typeof parsedObjectType === 'string' ? parsedObjectType : JSON.stringify(parsedObjectType);
    throw new OcpValidationError(
      'object_type',
      `Entity type "${entityType}" expects object_type "${expectedObjectType}", received "${receivedObjectTypeMessage}"`,
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: expectedObjectType,
        receivedValue: parsedObjectType,
      }
    );
  }

  return parsed;
}

/**
 * Clear schema caches (test utility).
 */
export function resetOcfSchemaRegistryForTests(): void {
  cachedAjv = null;
  cachedSchemaRootDir = null;
  validatorCache.clear();
  zodSchemaCache.clear();
}
