/**
 * Integration tests for PaymentStreamFactory operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Payment stream factory contracts deployed
 * - Multiple parties with proper permissions
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

createIntegrationTestSuite('PaymentStreamFactory operations', (getContext) => {
  /**
   * NOTE: PaymentStreamFactory tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Factory contracts deployed
   * 3. Payer and payee parties with proper setup
   *
   * These tests verify the SDK exports the expected functions.
   */

  test('SDK exports payment stream factory functions', () => {
    const ctx = getContext();

    // Verify SDK exports payment stream factory functions
    expect(ctx.ocp.PaymentStreams.paymentStreamFactory.buildCreatePaymentStreamProposalCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.paymentStreamFactory.buildCreatePaymentStreamProposalCommand).toBe('function');
  });

  test.skip('full payment stream proposal workflow - requires payment infrastructure', async () => {
    // This test would require:
    // 1. Create payment stream proposal
    // 2. Payee approves proposal
    // 3. Start the payment stream
    // 4. Process payments
    //
    // Skipped as it requires full Canton Network with payment stream support
  });
});
