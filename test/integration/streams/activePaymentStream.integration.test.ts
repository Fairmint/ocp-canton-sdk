/**
 * Integration tests for ActivePaymentStream operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Active payment streams
 * - Multiple parties with amulets
 *
 * These tests are skipped in basic LocalNet environments.
 *
 * Run with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';

createIntegrationTestSuite('ActivePaymentStream operations', (getContext) => {
  /**
   * NOTE: ActivePaymentStream tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Existing active payment stream contracts
   * 3. Payer party with amulets for payments
   *
   * These tests verify the SDK exports the expected functions.
   */

  test('SDK exports active payment stream functions', () => {
    const ctx = getContext();

    // Verify SDK exports active payment stream functions
    expect(ctx.ocp.PaymentStreams.activePaymentStream.buildProcessPaymentCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.activePaymentStream.buildProcessPaymentCommand).toBe('function');

    expect(ctx.ocp.PaymentStreams.activePaymentStream.buildCancelCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.activePaymentStream.buildCancelCommand).toBe('function');

    expect(ctx.ocp.PaymentStreams.activePaymentStream.buildProposeChangesCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.activePaymentStream.buildProposeChangesCommand).toBe('function');
  });

  test.skip('full active payment stream workflow - requires payment infrastructure', async () => {
    // This test would require:
    // 1. Have an existing active payment stream
    // 2. Process payments
    // 3. Propose and apply changes
    // 4. Cancel or archive the stream
    //
    // Skipped as it requires full Canton Network with payment stream support
  });
});
