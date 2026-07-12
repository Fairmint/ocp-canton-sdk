import type { ErrorObject, ValidateFunction } from 'ajv';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { z, ZodError, type ZodType } from 'zod';
import { OcpErrorCodes, OcpValidationError } from '../errors';
import {
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  type OcfDataTypeFor,
  type OcfEntityType,
  type OcfWritableDataTypeFor,
} from '../functions/OpenCapTable/capTable/entityTypes';
import {
  convertibleMechanismToDaml,
  ratioMechanismToDaml,
  warrantMechanismToDaml,
} from '../functions/OpenCapTable/shared/conversionMechanisms';
import {
  STAKEHOLDER_RELATIONSHIP_TYPES,
  type ConvertibleConversionMechanism,
  type PersistedStockClassRatioConversionMechanism,
  type PersistedWarrantConversionMechanism,
} from '../types/native';
import { assertConversionTriggerListSemantics } from './conversionTriggers';
import { assertSafeOcfJson } from './ocfJsonValidation';
import { normalizeOcfData } from './ocfNormalization';

const ENTITY_OBJECT_TYPE_MAP = Object.fromEntries(
  Object.entries(OCF_OBJECT_TYPE_TO_ENTITY_TYPE).map(([objectType, entityType]) => [entityType, objectType])
) as {
  readonly [EntityType in OcfEntityType]: OcfDataTypeFor<EntityType>['object_type'];
};

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

const OBJECTS_DIR_RELATIVE_PATH = 'objects';
const SCHEMA_FILE_SUFFIX = '.schema.json';
const PACKAGED_SCHEMA_DIR_RELATIVE_PATH = '../ocf-schema';
const SUBMODULE_SCHEMA_DIR_RELATIVE_PATH = '../../libs/Open-Cap-Format-OCF/schema';
const REPO_SCHEMA_DIR_RELATIVE_PATH = '../../Open-Cap-Format-OCF/schema';

let cachedAjv: Ajv | null = null;
let cachedSchemaRootDir: string | null = null;
let cachedConversionRightTypes: ReadonlySet<string> | null = null;

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
  if (error.keyword === 'additionalProperties' && 'additionalProperty' in error.params) {
    const { additionalProperty } = error.params as { additionalProperty: unknown };
    if (typeof additionalProperty === 'string' && additionalProperty.length > 0) {
      return [...pathFromPointer, additionalProperty];
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
  const validateOriginalObject = z
    .custom<Record<string, unknown>>((value) => isRecord(value), {
      message: 'Expected a JSON object',
    })
    .superRefine((value, ctx) => {
      // Validate the original object before z.record creates its parsed copy.
      // Otherwise special own keys such as `__proto__` can disappear during
      // record construction and evade an additionalProperties: false schema.
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

  // Preserve the existing plain-record output boundary after the original
  // own-key graph has passed strict schema validation.
  return validateOriginalObject.pipe(z.record(z.string(), z.unknown()));
}

function canonicalConversionRightTypes(): ReadonlySet<string> {
  if (cachedConversionRightTypes) return cachedConversionRightTypes;
  const schemaPath = path.join(resolveOcfSchemaDir(), 'enums', 'ConversionRightType.schema.json');
  const schema = readJsonFile(schemaPath);
  const values = schema.enum;
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    !values.every((value): value is string => typeof value === 'string' && value.length > 0)
  ) {
    throw new OcpValidationError('schemaFile.enum', 'ConversionRightType schema must define non-empty string values.', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty array of canonical conversion-right strings',
      receivedValue: values,
    });
  }
  cachedConversionRightTypes = new Set(values);
  return cachedConversionRightTypes;
}

function isCanonicalConversionRightType(value: string): boolean {
  return canonicalConversionRightTypes().has(value);
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
      if (!rightAllowedByObject) {
        ctx.addIssue({
          code: 'custom',
          path: [...segments, 'type'],
          message: `${objectType} does not permit conversion right ${rightType}`,
        });
      }
      if (
        rightType === 'STOCK_CLASS_CONVERSION_RIGHT' &&
        (typeof value.converts_to_stock_class_id !== 'string' || value.converts_to_stock_class_id.length === 0)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [...segments, 'converts_to_stock_class_id'],
          message: 'STOCK_CLASS_CONVERSION_RIGHT requires a non-empty converts_to_stock_class_id',
        });
      }
      // Mechanism compatibility is defined by the specialized pinned conversion-right schemas.
      // The refinement here only closes their missing required `type` discriminator.
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
  if (value.object_type === 'STAKEHOLDER') {
    if (value.current_relationships === undefined) return;
    if (!Array.isArray(value.current_relationships)) {
      throw new OcpValidationError('current_relationships', 'current_relationships must be an array', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'array of canonical stakeholder relationships',
        receivedValue: value.current_relationships,
      });
    }
    for (let index = 0; index < value.current_relationships.length; index += 1) {
      const relationship = value.current_relationships[index];
      const fieldPath = `current_relationships[${index}]`;
      if (typeof relationship !== 'string') {
        throw new OcpValidationError(fieldPath, 'Stakeholder relationship must be a string', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'canonical stakeholder relationship string',
          receivedValue: relationship,
        });
      }
      if (!(STAKEHOLDER_RELATIONSHIP_TYPES as readonly string[]).includes(relationship)) {
        throw new OcpValidationError(fieldPath, 'Unknown stakeholder relationship value', {
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: STAKEHOLDER_RELATIONSHIP_TYPES.join(' | '),
          receivedValue: relationship,
        });
      }
    }
    return;
  }

  if (value.object_type === 'CE_STAKEHOLDER_RELATIONSHIP') {
    for (const field of ['relationship_started', 'relationship_ended'] as const) {
      const relationship = value[field];
      if (relationship !== undefined && typeof relationship !== 'string') {
        throw new OcpValidationError(
          `stakeholderRelationshipChangeEvent.${field}`,
          `${field} must be a canonical stakeholder relationship string`,
          {
            code: OcpErrorCodes.INVALID_TYPE,
            expectedType: 'canonical stakeholder relationship string',
            receivedValue: relationship,
          }
        );
      }
    }

    if (value.relationship_started === undefined && value.relationship_ended === undefined) {
      throw new OcpValidationError(
        'stakeholderRelationshipChangeEvent',
        'One of relationship_started or relationship_ended is required',
        {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'relationship_started or relationship_ended',
          receivedValue: value,
        }
      );
    }
    return;
  }

  if (value.object_type !== 'TX_EQUITY_COMPENSATION_ISSUANCE') return;

  for (const field of ['exercise_price', 'base_price'] as const) {
    if (value[field] === null) {
      throw new OcpValidationError(field, `${field} must be a Monetary object when provided`, {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'Monetary or omitted',
        receivedValue: value[field],
      });
    }
  }

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

const NON_CANONICAL_PUBLIC_FIELDS: Readonly<Partial<Record<OcfSchemaObjectType, readonly string[]>>> = {
  STAKEHOLDER: ['current_relationship'],
  CE_STAKEHOLDER_RELATIONSHIP: ['new_relationships'],
  TX_STOCK_CONVERSION: ['quantity'],
  TX_EQUITY_COMPENSATION_RELEASE: ['balance_security_id'],
  TX_EQUITY_COMPENSATION_ISSUANCE: ['plan_security_type'],
  TX_STOCK_CLASS_SPLIT: [
    'split_ratio_numerator',
    'split_ratio_denominator',
    'board_approval_date',
    'stockholder_approval_date',
  ],
  TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT: ['board_approval_date', 'stockholder_approval_date'],
  TX_STOCK_CONSOLIDATION: ['resulting_security_ids'],
  TX_EQUITY_COMPENSATION_REPRICING: ['resulting_security_ids'],
  TX_WARRANT_ISSUANCE: ['ratio_numerator', 'ratio_denominator', 'percent_of_outstanding', 'conversion_triggers'],
  TX_WARRANT_EXERCISE: ['quantity', 'balance_security_id'],
  CE_STAKEHOLDER_STATUS: ['reason_text'],
};

/**
 * Deprecated fields accepted only by raw, schema-faithful OCF ingestion.
 *
 * The public SDK DTOs intentionally omit these fields, so typed entity and
 * writer boundaries must reject them instead of silently canonicalizing them.
 */
const RAW_INGESTION_COMPATIBILITY_FIELDS: Readonly<Partial<Record<OcfSchemaObjectType, readonly string[]>>> = {
  STOCK_PLAN: ['stock_class_id'],
  TX_EQUITY_COMPENSATION_ISSUANCE: ['option_grant_type'],
};

/** Reject obsolete aliases and unsupported extensions before normalization can hide them. */
function validateCanonicalPublicFieldPurity(value: Record<string, unknown>, objectType: OcfSchemaObjectType): void {
  const forbiddenFields = NON_CANONICAL_PUBLIC_FIELDS[objectType] ?? [];
  for (const field of forbiddenFields) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new OcpValidationError(field, `${field} is not part of the canonical ${objectType} SDK DTO`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'absent',
        receivedValue: value[field],
      });
    }
  }
}

function validateCanonicalTypedFieldPurity(value: Record<string, unknown>, objectType: OcfSchemaObjectType): void {
  const compatibilityFields = RAW_INGESTION_COMPATIBILITY_FIELDS[objectType] ?? [];
  for (const field of compatibilityFields) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new OcpValidationError(field, `${field} is available only at the raw OCF ingestion boundary`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'absent',
        receivedValue: value[field],
      });
    }
  }
}

function parseWithOcfSchema(input: Record<string, unknown>, objectType: string): Record<string, unknown> {
  const schema = getOcfSchema(objectType);
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw convertZodErrorToValidationError(error, 'ocfObject');
    }
    throw error;
  }
}

/** Enforce pinned ledger-v35 refinements only at the SDK's strongly typed entity boundary. */
function validateTypedConversionRefinements(value: Record<string, unknown>): void {
  if (value.object_type === 'TX_CONVERTIBLE_ISSUANCE' && Array.isArray(value.conversion_triggers)) {
    assertConversionTriggerListSemantics(
      value.conversion_triggers,
      'conversion_triggers',
      OcpErrorCodes.INVALID_FORMAT
    );
  }
  if (value.object_type === 'TX_WARRANT_ISSUANCE' && Array.isArray(value.exercise_triggers)) {
    assertConversionTriggerListSemantics(value.exercise_triggers, 'exercise_triggers', OcpErrorCodes.INVALID_FORMAT);
  }

  const visit = (current: unknown, currentPath: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, currentPath === '' ? `${index}` : `${currentPath}.${index}`));
      return;
    }
    if (!isRecord(current)) return;

    const mechanism = current.conversion_mechanism;
    const mechanismPath = currentPath === '' ? 'conversion_mechanism' : `${currentPath}.conversion_mechanism`;
    switch (current.type) {
      case 'CONVERTIBLE_CONVERSION_RIGHT':
        convertibleMechanismToDaml(mechanism as ConvertibleConversionMechanism, mechanismPath);
        break;
      case 'WARRANT_CONVERSION_RIGHT':
        warrantMechanismToDaml(mechanism as PersistedWarrantConversionMechanism, mechanismPath);
        break;
      case 'STOCK_CLASS_CONVERSION_RIGHT':
        ratioMechanismToDaml(mechanism as PersistedStockClassRatioConversionMechanism, mechanismPath);
        break;
    }

    for (const [key, child] of Object.entries(current)) {
      visit(child, currentPath === '' ? key : `${currentPath}.${key}`);
    }
  };

  visit(value, '');
}

/**
 * Parse and validate an arbitrary OCF JSON object.
 *
 * Non-schema and obsolete DTO fields are rejected, and the declared source
 * shape is validated before schema-supported aliases are normalized to the
 * SDK's canonical forms. Retired PlanSecurity object types are rejected.
 */
export function parseOcfObject(input: unknown): Record<string, unknown> {
  assertSafeOcfJson(input, 'ocfObject');
  if (!isRecord(input)) {
    throw new OcpValidationError('ocfObject', 'Expected a JSON object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Record<string, unknown>',
      receivedValue: input,
    });
  }

  const declaredObjectType = input.object_type;
  if (typeof declaredObjectType !== 'string' || declaredObjectType.length === 0) {
    throw new OcpValidationError('object_type', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: declaredObjectType,
    });
  }

  const sourceObjectType = resolveSchemaObjectType(declaredObjectType);
  validateCanonicalPublicFieldPurity(input, sourceObjectType);
  validateCanonicalSemanticRefinements(input);
  const source = parseWithOcfSchema(input, sourceObjectType);

  let normalized: Record<string, unknown>;
  try {
    normalized = normalizeOcfData(source);
  } catch (error) {
    if (error instanceof OcpValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Failed to normalize OCF data';
    throw new OcpValidationError('ocfObject', message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: source,
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

  validateCanonicalSemanticRefinements(normalized);
  return parseWithOcfSchema(normalized, objectType);
}

/**
 * Parse and validate OCF input for a specific SDK entity type.
 *
 * Typed SDK inputs must provide the exact canonical object_type for the entity.
 * The result is narrowed to the subset that the current DAML package can
 * persist after its ledger-specific refinements pass.
 * Compatibility fields that normalize to canonical DTOs remain available only
 * through the raw {@link parseOcfObject} ingestion boundary.
 */
export function parseOcfEntityInput<T extends OcfEntityType>(entityType: T, input: unknown): OcfWritableDataTypeFor<T> {
  assertSafeOcfJson(input, entityType);
  if (!isRecord(input)) {
    throw new OcpValidationError(`${entityType}`, 'Expected a JSON object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Record<string, unknown>',
      receivedValue: input,
    });
  }

  if (entityType === 'stockPlan' && Object.prototype.hasOwnProperty.call(input, 'stock_class_id')) {
    throw new OcpValidationError('stock_class_id', 'Typed stock plan input requires canonical stock_class_ids', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'stock_class_ids: [string, ...string[]]',
      receivedValue: input.stock_class_id,
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

  validateCanonicalTypedFieldPurity(objectInput, expectedObjectType);

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

  validateTypedConversionRefinements(parsed);
  return parsed as OcfWritableDataTypeFor<T>;
}

/**
 * Clear schema caches (test utility).
 */
export function resetOcfSchemaRegistryForTests(): void {
  cachedAjv = null;
  cachedSchemaRootDir = null;
  cachedConversionRightTypes = null;
  validatorCache.clear();
  zodSchemaCache.clear();
}
