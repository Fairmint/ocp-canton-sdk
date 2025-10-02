import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';

// Map of object_type to schema file paths relative to the schema directory
const SCHEMA_MAP: Record<string, string> = {
  ISSUER: 'objects/Issuer.schema.json',
  STAKEHOLDER: 'objects/Stakeholder.schema.json',
  STOCK_CLASS: 'objects/StockClass.schema.json',
  STOCK_LEGEND_TEMPLATE: 'objects/StockLegendTemplate.schema.json',
  VESTING_TERMS: 'objects/VestingTerms.schema.json',
  STOCK_PLAN: 'objects/StockPlan.schema.json',
  TX_STOCK_ISSUANCE: 'objects/transactions/issuance/StockIssuance.schema.json',
  TX_STOCK_CANCELLATION: 'objects/transactions/cancellation/StockCancellation.schema.json',
  TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT:
    'objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.schema.json',
  TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT:
    'objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.schema.json',
  TX_STOCK_PLAN_POOL_ADJUSTMENT:
    'objects/transactions/adjustment/StockPlanPoolAdjustment.schema.json',
  TX_EQUITY_COMPENSATION_ISSUANCE:
    'objects/transactions/issuance/EquityCompensationIssuance.schema.json',
  TX_EQUITY_COMPENSATION_EXERCISE:
    'objects/transactions/exercise/EquityCompensationExercise.schema.json',
  TX_WARRANT_ISSUANCE: 'objects/transactions/issuance/WarrantIssuance.schema.json',
  TX_CONVERTIBLE_ISSUANCE: 'objects/transactions/issuance/ConvertibleIssuance.schema.json',
  DOCUMENT: 'objects/Document.schema.json',
};

class OcfSchemaValidator {
  private ajv: Ajv;
  private schemaDir: string;
  private validators: Map<string, ValidateFunction> = new Map();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: true,
      loadSchema: this.loadSchemaFromFile.bind(this),
    });

    // Add format validators
    addFormats(this.ajv);

    // Resolve the schema directory path (from submodule in project root)
    this.schemaDir = path.resolve(__dirname, '../..', 'Open-Cap-Format-OCF/schema');

    if (!fs.existsSync(this.schemaDir)) {
      throw new Error(`Schema directory not found at: ${this.schemaDir}`);
    }
  }

  /**
   * Load a schema file from the filesystem
   */
  private async loadSchemaFromFile(uri: string): Promise<Record<string, unknown>> {
    // Extract the relative path from the URI
    const match = uri.match(/Open-Cap-Format-OCF\/main\/schema\/(.+)$/);
    if (!match) {
      throw new Error(`Unable to parse schema URI: ${uri}`);
    }

    const relativePath = match[1];
    const filePath = path.join(this.schemaDir, relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Schema file not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  }

  /**
   * Get or compile a validator for a specific object type
   */
  private async getValidator(objectType: string): Promise<ValidateFunction> {
    if (this.validators.has(objectType)) {
      return this.validators.get(objectType)!;
    }

    const schemaPath = SCHEMA_MAP[objectType];
    if (!schemaPath) {
      throw new Error(`No schema mapping found for object type: ${objectType}`);
    }

    const fullSchemaPath = path.join(this.schemaDir, schemaPath);
    if (!fs.existsSync(fullSchemaPath)) {
      throw new Error(`Schema file not found: ${fullSchemaPath}`);
    }

    const schemaContent = fs.readFileSync(fullSchemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Compile the schema (this will trigger loading of all referenced schemas)
    const validator = await this.ajv.compileAsync(schema);
    this.validators.set(objectType, validator);

    return validator;
  }

  /**
   * Validate an OCF object against its schema
   */
  async validate(
    ocfObject: Record<string, unknown>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const objectType = ocfObject.object_type as string;
    if (!objectType) {
      return {
        valid: false,
        errors: ['object_type field is required'],
      };
    }

    try {
      const validator = await this.getValidator(objectType);
      const valid = validator(ocfObject);

      if (!valid && validator.errors) {
        const errors = validator.errors.map((error) => {
          const path = error.instancePath ?? '';
          const message = error.message ?? '';
          const params = error.params ? JSON.stringify(error.params) : '';
          return `${path} ${message} ${params}`.trim();
        });
        return { valid: false, errors };
      }

      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}

// Singleton instance
let validatorInstance: OcfSchemaValidator | undefined;

/**
 * Get the global validator instance
 */
export function getOcfValidator(): OcfSchemaValidator {
  validatorInstance ??= new OcfSchemaValidator();
  return validatorInstance;
}

/**
 * Validate an OCF object
 */
export async function validateOcfObject(ocfObject: Record<string, unknown>): Promise<void> {
  const validator = getOcfValidator();
  const result = await validator.validate(ocfObject);

  if (!result.valid) {
    const errorMessage = `OCF validation failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}
