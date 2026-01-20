import type { ValidateFunction } from 'ajv';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

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
  TX_WARRANT_CANCELLATION: 'objects/transactions/cancellation/WarrantCancellation.schema.json',
  TX_CONVERTIBLE_CANCELLATION: 'objects/transactions/cancellation/ConvertibleCancellation.schema.json',
  TX_EQUITY_COMPENSATION_CANCELLATION: 'objects/transactions/cancellation/EquityCompensationCancellation.schema.json',
  TX_STOCK_TRANSFER: 'objects/transactions/transfer/StockTransfer.schema.json',
  TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT:
    'objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.schema.json',
  TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT:
    'objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.schema.json',
  TX_STOCK_PLAN_POOL_ADJUSTMENT: 'objects/transactions/adjustment/StockPlanPoolAdjustment.schema.json',
  TX_EQUITY_COMPENSATION_ISSUANCE: 'objects/transactions/issuance/EquityCompensationIssuance.schema.json',
  TX_EQUITY_COMPENSATION_EXERCISE: 'objects/transactions/exercise/EquityCompensationExercise.schema.json',
  TX_WARRANT_ISSUANCE: 'objects/transactions/issuance/WarrantIssuance.schema.json',
  TX_CONVERTIBLE_ISSUANCE: 'objects/transactions/issuance/ConvertibleIssuance.schema.json',
  TX_STOCK_REPURCHASE: 'objects/transactions/repurchase/StockRepurchase.schema.json',
  DOCUMENT: 'objects/Document.schema.json',
};

class OcfSchemaValidator {
  private readonly ajv: Ajv;
  private readonly schemaDir: string;
  private readonly validators: Map<string, ValidateFunction> = new Map();
  private readonly schemasAvailable: boolean;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false, // TODO enable strict mode, at least on the outputs
      validateFormats: true,
      loadSchema: this.loadSchemaFromFile.bind(this),
    });

    // Add format validators
    addFormats(this.ajv);

    // Resolve the schema directory path (from submodule in project root)
    this.schemaDir = path.resolve(__dirname, '../..', 'libs/Open-Cap-Format-OCF/schema');

    // Check if schemas are available (submodule initialized)
    this.schemasAvailable = fs.existsSync(this.schemaDir);
  }

  /**
   * Check if OCF schemas are available.
   *
   * Returns false if the OCF submodule is not initialized. This allows tests to conditionally skip validation or
   * provide helpful error messages.
   */
  isAvailable(): boolean {
    return this.schemasAvailable;
  }

  /**
   * Get the schema directory path.
   *
   * Useful for error messages that tell users how to initialize the submodule.
   */
  getSchemaDir(): string {
    return this.schemaDir;
  }

  /** Load a schema file from the filesystem */
  private async loadSchemaFromFile(uri: string): Promise<Record<string, unknown>> {
    if (!this.schemasAvailable) {
      throw new Error(this.getUnavailableMessage());
    }

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
    return Promise.resolve(JSON.parse(fileContent));
  }

  /** Get a helpful error message when schemas are unavailable */
  private getUnavailableMessage(): string {
    return (
      `OCF schema validation unavailable.\n\n` +
      `The OCF schema submodule is not initialized at:\n` +
      `  ${this.schemaDir}\n\n` +
      `To enable OCF validation, initialize the submodule:\n` +
      `  git submodule update --init --recursive libs/Open-Cap-Format-OCF\n\n` +
      `This is required for CI. For local development, you can skip validation by\n` +
      `setting OCP_SKIP_OCF_VALIDATION=true in your environment.`
    );
  }

  /** Get or compile a validator for a specific object type */
  private async getValidator(objectType: string): Promise<ValidateFunction> {
    if (!this.schemasAvailable) {
      throw new Error(this.getUnavailableMessage());
    }

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

  /** Validate an OCF object against its schema */
  async validate(ocfObject: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }> {
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
          const errorPath = error.instancePath;
          const message = error.message ?? '';
          const params = JSON.stringify(error.params);
          return `${errorPath} ${message} ${params}`.trim();
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

/** Get the global validator instance */
export function getOcfValidator(): OcfSchemaValidator {
  validatorInstance ??= new OcfSchemaValidator();
  return validatorInstance;
}

/**
 * Check if OCF schema validation is available.
 *
 * Returns false if the OCF submodule is not initialized.
 *
 * @example
 *   ```typescript
 *
 *   if (!isOcfValidationAvailable()) {
 *     console.warn('OCF validation skipped - submodule not initialized');
 *     return;
 *   }
 *   await validateOcfObject(data);
 *   ```;
 */
export function isOcfValidationAvailable(): boolean {
  return getOcfValidator().isAvailable();
}

/**
 * Validate an OCF object against its schema.
 *
 * @example
 *   ```typescript
 *
 *   await validateOcfObject({ object_type: 'ISSUER', ... });
 *   ```;
 *
 * @throws Error if validation fails or if OCF schemas are not available (unless OCP_SKIP_OCF_VALIDATION=true is set)
 */
export async function validateOcfObject(ocfObject: Record<string, unknown>): Promise<void> {
  const validator = getOcfValidator();

  // Allow skipping validation in development (but not CI)
  if (!validator.isAvailable()) {
    const skipValidation = process.env.OCP_SKIP_OCF_VALIDATION === 'true';
    if (skipValidation) {
      // In development, allow skipping validation with a warning
      console.warn(
        '[OCF Validation] Skipping validation - OCF submodule not initialized.\n' +
          '  Run: git submodule update --init --recursive libs/Open-Cap-Format-OCF'
      );
      return;
    }
    // In CI or when strict validation is needed, fail with helpful message
    throw new Error(
      `OCF schema validation unavailable.\n\n` +
        `The OCF schema submodule is not initialized at:\n` +
        `  ${validator.getSchemaDir()}\n\n` +
        `To enable OCF validation, initialize the submodule:\n` +
        `  git submodule update --init --recursive libs/Open-Cap-Format-OCF\n\n` +
        `To skip validation (development only), set:\n` +
        `  export OCP_SKIP_OCF_VALIDATION=true`
    );
  }

  const result = await validator.validate(ocfObject);

  if (!result.valid) {
    const errorMessage = `OCF validation failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

/**
 * Reset the validator instance.
 *
 * Useful for testing the validator itself.
 *
 * @internal
 */
export function resetOcfValidator(): void {
  validatorInstance = undefined;
}
