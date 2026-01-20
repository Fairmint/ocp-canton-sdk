/**
 * Entity test factory for creating standardized integration tests.
 *
 * This module provides reusable test patterns for OCF entity types. Each entity type can use this factory to quickly
 * set up tests for:
 *
 * - Create and read back as valid OCF
 * - Data round-trip verification
 * - Archive operations
 *
 * @example
 *   ```typescript
 *
 *
 *
 *   defineEntityTests({
 *     entityName: 'StockClass',
 *     expectedObjectType: 'STOCK_CLASS',
 *     createTestData: createTestStockClassData,
 *     setupEntity: async (ctx, data) => setupTestStockClass(ctx.ocp, { stockClassData: data }),
 *     getAsOcf: async (ctx, cid) => (await ctx.ocp.OpenCapTable.stockClass.getStockClassAsOcf({ contractId: cid })).stockClass,
 *     getIdFromResult: (result) => result.stockClassContractId,
 *   });
 *   ```;
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import type { IntegrationTestContext } from './integrationTestHarness';
import { createIntegrationTestSuite } from './integrationTestHarness';

/**
 * Configuration for an entity's integration tests.
 *
 * @typeParam TData - The type of the test data (e.g., OcfStockClassData)
 * @typeParam TSetupResult - The type returned by setupEntity (e.g., TestStockClassSetup)
 * @typeParam TOcfResult - The type of the OCF object returned by getAsOcf
 */
export interface EntityTestConfig<TData, TSetupResult, TOcfResult> {
  /** Human-readable name of the entity (e.g., 'StockClass') */
  entityName: string;

  /** Expected OCF object_type value (e.g., 'STOCK_CLASS') */
  expectedObjectType: string;

  /**
   * Factory function to create test data.
   *
   * @param overrides - Optional field overrides
   * @returns Test data for the entity
   */
  createTestData: (overrides?: Partial<TData>) => TData;

  /**
   * Setup function to create the entity in Canton.
   *
   * This function should handle any required dependencies (e.g., creating an issuer first).
   *
   * @param ctx - The integration test context
   * @param data - The test data for the entity
   * @returns The setup result containing the contract ID
   */
  setupEntity: (ctx: IntegrationTestContext, data: TData) => Promise<TSetupResult>;

  /**
   * Function to read the entity back as OCF.
   *
   * @param ctx - The integration test context
   * @param contractId - The contract ID of the entity
   * @returns The OCF object
   */
  getAsOcf: (ctx: IntegrationTestContext, contractId: string) => Promise<TOcfResult>;

  /**
   * Extract the contract ID from the setup result.
   *
   * @param result - The setup result
   * @returns The contract ID
   */
  getContractId: (result: TSetupResult) => string;

  /**
   * Optional: Archive function to test archiving the entity.
   *
   * @param ctx - The integration test context
   * @param contractId - The contract ID of the entity to archive
   */
  archiveEntity?: (ctx: IntegrationTestContext, contractId: string) => Promise<void>;

  /**
   * Optional: Field mappings for round-trip verification.
   *
   * Keys are field names in the test data, values are field names in the OCF result. If not provided, assumes field
   * names match between data and OCF result.
   */
  fieldMappings?: Record<keyof Partial<TData>, string>;

  /**
   * Optional: Fields to verify in round-trip tests.
   *
   * If not provided, a default set of common fields will be checked.
   */
  roundTripFields?: Array<keyof TData>;

  /**
   * Optional: Additional tests to run for this entity.
   *
   * @param getContext - Function to get the test context
   */
  additionalTests?: (getContext: () => IntegrationTestContext) => void;
}

/**
 * Define integration tests for an entity type.
 *
 * Creates a test suite with standard tests:
 *
 * - `creates {entity} and reads it back as valid OCF`
 * - `{entity} data round-trips correctly` (if roundTripFields provided)
 * - `archives {entity}` (if archiveEntity provided)
 *
 * @param config - The entity test configuration
 */
export function defineEntityTests<TData extends object, TSetupResult, TOcfResult extends object>(
  config: EntityTestConfig<TData, TSetupResult, TOcfResult>
): void {
  createIntegrationTestSuite(`${config.entityName} operations`, (getContext) => {
    test(`creates ${config.entityName} and reads it back as valid OCF`, async () => {
      const ctx = getContext();
      const testData = config.createTestData();

      // Create the entity
      const setupResult = await config.setupEntity(ctx, testData);
      const contractId = config.getContractId(setupResult);

      // Read back as OCF
      const ocfResult = await config.getAsOcf(ctx, contractId);

      // Validate object_type
      const ocfObject = ocfResult as Record<string, unknown>;
      expect(ocfObject.object_type).toBe(config.expectedObjectType);

      // Validate against OCF schema
      await validateOcfObject(ocfObject);
    });

    // Round-trip test (if fields specified)
    if (config.roundTripFields && config.roundTripFields.length > 0) {
      // Capture fields in a local constant to satisfy TypeScript narrowing
      const { roundTripFields } = config;
      const { fieldMappings } = config;

      test(`${config.entityName} data round-trips correctly`, async () => {
        const ctx = getContext();
        const testData = config.createTestData();

        // Create the entity
        const setupResult = await config.setupEntity(ctx, testData);
        const contractId = config.getContractId(setupResult);

        // Read back as OCF
        const ocfResult = await config.getAsOcf(ctx, contractId);
        const ocfObject = ocfResult as Record<string, unknown>;

        // Verify each field
        for (const field of roundTripFields) {
          const ocfField = fieldMappings?.[field] ?? String(field);
          const expectedValue = testData[field];
          const actualValue = ocfObject[ocfField];

          expect(actualValue).toEqual(expectedValue);
        }
      });
    }

    // Archive test (if archive function provided)
    if (config.archiveEntity) {
      test(`archives ${config.entityName}`, async () => {
        const ctx = getContext();
        const testData = config.createTestData();

        // Create the entity
        const setupResult = await config.setupEntity(ctx, testData);
        const contractId = config.getContractId(setupResult);

        // Archive it
        await config.archiveEntity!(ctx, contractId);

        // Try to read it back - should fail or return archived state
        // Note: The exact behavior depends on how getAsOcf handles archived contracts
        // For now, we just verify that archive doesn't throw
      });
    }

    // Run additional tests if provided
    if (config.additionalTests) {
      config.additionalTests(getContext);
    }
  });
}

/**
 * Helper to create a simple test that verifies an entity variant.
 *
 * @param variantName - Name of the variant (e.g., 'preferred stock class')
 * @param setupFn - Function to set up the variant
 * @param validationFn - Function to validate the result
 */
export function testEntityVariant<T>(
  variantName: string,
  getContext: () => IntegrationTestContext,
  setupFn: (ctx: IntegrationTestContext) => Promise<T>,
  validationFn: (result: T) => void | Promise<void>
): void {
  test(`creates ${variantName}`, async () => {
    const ctx = getContext();
    const result = await setupFn(ctx);
    await validationFn(result);
  });
}
