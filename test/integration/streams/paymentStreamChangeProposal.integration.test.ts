/**
 * Integration tests for PaymentStreamChangeProposal operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Active payment streams with pending change proposals
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

createIntegrationTestSuite('PaymentStreamChangeProposal operations', (getContext) => {
  /**
   * NOTE: PaymentStreamChangeProposal tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Existing payment stream change proposals
   * 3. Payer and payee parties with proper setup
   *
   * These tests verify the SDK exports the expected functions.
   */

  test('SDK exports payment stream change proposal functions', () => {
    const ctx = getContext();

    // Verify SDK exports payment stream change proposal functions
    expect(ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildApproveCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildApproveCommand).toBe('function');

    expect(ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildApplyCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildApplyCommand).toBe('function');

    expect(ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildRejectCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildRejectCommand).toBe('function');
  });

  test.skip('full change proposal workflow - requires payment infrastructure', async () => {
    // This test would require:
    // 1. Have an active payment stream
    // 2. Propose changes
    // 3. Approve or reject the proposal
    // 4. Apply the changes
    //
    // Skipped as it requires full Canton Network with payment stream support
  });
});
