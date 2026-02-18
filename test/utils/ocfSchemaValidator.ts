import * as path from 'path';
import { OcpValidationError } from '../../src/errors';
import { parseOcfObject, resetOcfSchemaRegistryForTests, resolveOcfSchemaDir } from '../../src/utils/ocfZodSchemas';

class OcfSchemaValidator {
  private readonly schemaDir: string;
  private readonly schemasAvailable: boolean;

  constructor() {
    // Default path shown in diagnostics for discoverability.
    this.schemaDir = path.resolve(__dirname, '../..', 'libs/Open-Cap-Format-OCF/schema');
    try {
      resolveOcfSchemaDir();
      this.schemasAvailable = true;
    } catch {
      this.schemasAvailable = false;
    }
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

  /** Validate an OCF object against its schema */
  async validate(ocfObject: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }> {
    try {
      await Promise.resolve(parseOcfObject(ocfObject));
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof OcpValidationError) {
        return {
          valid: false,
          errors: [error.message],
        };
      }
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
 */
export function isOcfValidationAvailable(): boolean {
  return getOcfValidator().isAvailable();
}

/**
 * Validate an OCF object against its schema.
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
  resetOcfSchemaRegistryForTests();
}
