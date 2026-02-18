import type { ErrorObject, ValidateFunction } from 'ajv';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { z, ZodError, type ZodType } from 'zod';
import { OcpErrorCodes, OcpValidationError } from '../errors';
import type { OcfDataTypeFor, OcfEntityType } from '../functions/OpenCapTable/capTable/batchTypes';
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

/**
 * Canonical object_type expected for each SDK entity type.
 */
const ENTITY_TYPE_TO_OBJECT_TYPE: Record<OcfEntityType, OcfSchemaObjectType> = {
  issuer: 'ISSUER',
  stakeholder: 'STAKEHOLDER',
  stockClass: 'STOCK_CLASS',
  stockLegendTemplate: 'STOCK_LEGEND_TEMPLATE',
  stockPlan: 'STOCK_PLAN',
  vestingTerms: 'VESTING_TERMS',
  valuation: 'VALUATION',
  document: 'DOCUMENT',

  stockIssuance: 'TX_STOCK_ISSUANCE',
  stockCancellation: 'TX_STOCK_CANCELLATION',
  stockTransfer: 'TX_STOCK_TRANSFER',
  stockAcceptance: 'TX_STOCK_ACCEPTANCE',
  stockConversion: 'TX_STOCK_CONVERSION',
  stockRepurchase: 'TX_STOCK_REPURCHASE',
  stockReissuance: 'TX_STOCK_REISSUANCE',
  stockRetraction: 'TX_STOCK_RETRACTION',
  stockConsolidation: 'TX_STOCK_CONSOLIDATION',

  stockClassAuthorizedSharesAdjustment: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
  stockClassConversionRatioAdjustment: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
  stockClassSplit: 'TX_STOCK_CLASS_SPLIT',
  issuerAuthorizedSharesAdjustment: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
  stockPlanPoolAdjustment: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
  stockPlanReturnToPool: 'TX_STOCK_PLAN_RETURN_TO_POOL',

  convertibleIssuance: 'TX_CONVERTIBLE_ISSUANCE',
  convertibleCancellation: 'TX_CONVERTIBLE_CANCELLATION',
  convertibleTransfer: 'TX_CONVERTIBLE_TRANSFER',
  convertibleAcceptance: 'TX_CONVERTIBLE_ACCEPTANCE',
  convertibleConversion: 'TX_CONVERTIBLE_CONVERSION',
  convertibleRetraction: 'TX_CONVERTIBLE_RETRACTION',

  warrantIssuance: 'TX_WARRANT_ISSUANCE',
  warrantCancellation: 'TX_WARRANT_CANCELLATION',
  warrantTransfer: 'TX_WARRANT_TRANSFER',
  warrantAcceptance: 'TX_WARRANT_ACCEPTANCE',
  warrantExercise: 'TX_WARRANT_EXERCISE',
  warrantRetraction: 'TX_WARRANT_RETRACTION',

  equityCompensationIssuance: 'TX_EQUITY_COMPENSATION_ISSUANCE',
  equityCompensationCancellation: 'TX_EQUITY_COMPENSATION_CANCELLATION',
  equityCompensationTransfer: 'TX_EQUITY_COMPENSATION_TRANSFER',
  equityCompensationAcceptance: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
  equityCompensationExercise: 'TX_EQUITY_COMPENSATION_EXERCISE',
  equityCompensationRelease: 'TX_EQUITY_COMPENSATION_RELEASE',
  equityCompensationRetraction: 'TX_EQUITY_COMPENSATION_RETRACTION',
  equityCompensationRepricing: 'TX_EQUITY_COMPENSATION_REPRICING',

  // PlanSecurity aliases canonicalize to equity compensation
  planSecurityIssuance: 'TX_EQUITY_COMPENSATION_ISSUANCE',
  planSecurityCancellation: 'TX_EQUITY_COMPENSATION_CANCELLATION',
  planSecurityTransfer: 'TX_EQUITY_COMPENSATION_TRANSFER',
  planSecurityAcceptance: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
  planSecurityExercise: 'TX_EQUITY_COMPENSATION_EXERCISE',
  planSecurityRelease: 'TX_EQUITY_COMPENSATION_RELEASE',
  planSecurityRetraction: 'TX_EQUITY_COMPENSATION_RETRACTION',

  vestingAcceleration: 'TX_VESTING_ACCELERATION',
  vestingEvent: 'TX_VESTING_EVENT',
  vestingStart: 'TX_VESTING_START',

  stakeholderRelationshipChangeEvent: 'CE_STAKEHOLDER_RELATIONSHIP',
  stakeholderStatusChangeEvent: 'CE_STAKEHOLDER_STATUS',

  // Included in object schemas though not currently modeled as SDK entity operations
  // (kept here only to satisfy totality of Record<OcfEntityType,...>)
} satisfies Record<OcfEntityType, OcfSchemaObjectType>;

const OBJECTS_DIR_RELATIVE_PATH = 'objects';
const SCHEMA_FILE_SUFFIX = '.schema.json';

let cachedAjv: Ajv | null = null;
let cachedSchemaRootDir: string | null = null;

const validatorCache = new Map<OcfSchemaObjectType, ValidateFunction>();
const zodSchemaCache = new Map<string, ZodType<Record<string, unknown>>>();

/**
 * Resolve the local OCF schema directory.
 */
export function resolveOcfSchemaDir(): string {
  const candidates = [
    process.env.OCP_OCF_SCHEMA_DIR,
    path.resolve(__dirname, '../../libs/Open-Cap-Format-OCF/schema'),
    path.resolve(__dirname, '../../Open-Cap-Format-OCF/schema'),
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);

  for (const candidate of candidates) {
    const objectsDir = path.join(candidate, OBJECTS_DIR_RELATIVE_PATH);
    if (fs.existsSync(objectsDir)) {
      return candidate;
    }
  }

  throw new OcpValidationError(
    'ocfSchemaDir',
    `OCF schema directory not found. Set OCP_OCF_SCHEMA_DIR or initialize submodule with ` +
      `"git submodule update --init --recursive libs/Open-Cap-Format-OCF".`,
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
  if (objectType in OCF_OBJECT_SCHEMA_PATHS) {
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

  if (!validator) {
    validator = ajv.compile(schema);
  }

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
  const instancePath = error.instancePath || '/';
  const message = error.message ?? 'schema validation failed';
  const params = JSON.stringify(error.params);
  return `${instancePath}: ${message} ${params}`;
}

function convertZodErrorToValidationError(error: ZodError, contextField: string): OcpValidationError {
  const firstIssue = error.issues[0];
  const issuePath = firstIssue.path.join('.') || contextField;
  const issueMessage = error.issues
    .map((issue) => `[${issue.path.join('.') || contextField}] ${issue.message}`)
    .join('; ');

  return new OcpValidationError(issuePath, issueMessage || 'OCF schema validation failed', {
    code: OcpErrorCodes.INVALID_FORMAT,
    receivedValue: error.issues,
  });
}

function createSchemaForObjectType(objectType: OcfSchemaObjectType): ZodType<Record<string, unknown>> {
  const validator = getAjvValidator(objectType);
  return z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
    const valid = validator(value);
    if (valid) return;

    const errors = validator.errors ?? [];
    for (const error of errors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ajvErrorToPath(error),
        message: formatAjvError(error),
      });
    }
  });
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

/**
 * Parse and validate an arbitrary OCF JSON object.
 *
 * Deprecated/legacy aliases are normalized to canonical latest forms prior to strict validation.
 */
export function parseOcfObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new OcpValidationError('ocfObject', 'Expected a JSON object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Record<string, unknown>',
      receivedValue: input,
    });
  }

  const normalized = normalizeOcfData(input as Record<string, unknown>);
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
    return schema.parse(normalized);
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
 * If object_type is missing, the canonical object_type for the entity is injected before validation.
 */
export function parseOcfEntityInput<T extends OcfEntityType>(entityType: T, input: unknown): OcfDataTypeFor<T> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new OcpValidationError(`${entityType}`, 'Expected a JSON object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Record<string, unknown>',
      receivedValue: input,
    });
  }

  const expectedObjectType = ENTITY_TYPE_TO_OBJECT_TYPE[entityType];
  const objectInput = input as Record<string, unknown>;

  const withObjectType =
    typeof objectInput.object_type === 'string' && objectInput.object_type.length > 0
      ? objectInput
      : ({ ...objectInput, object_type: expectedObjectType } as Record<string, unknown>);

  const parsed = parseOcfObject(withObjectType);
  const parsedObjectType = parsed.object_type;
  if (parsedObjectType !== expectedObjectType) {
    throw new OcpValidationError(
      'object_type',
      `Entity type "${entityType}" expects object_type "${expectedObjectType}", received "${String(parsedObjectType)}"`,
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: expectedObjectType,
        receivedValue: parsedObjectType,
      }
    );
  }

  return parsed as unknown as OcfDataTypeFor<T>;
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
