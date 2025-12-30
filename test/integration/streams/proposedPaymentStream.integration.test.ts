/**
 * Integration tests for ProposedPaymentStream operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Active payment stream proposals
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

import { createIntegrationTestSuite, skipIfValidatorUnavailable } from '../setup';

createIntegrationTestSuite('ProposedPaymentStream operations', (getContext) => {
  /**
   * NOTE: ProposedPaymentStream tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Existing proposed payment stream contracts
   * 3. Payer and payee parties with proper setup
   *
   * These tests verify the SDK exports the expected functions.
   */

  test('SDK exports proposed payment stream functions', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    // Verify SDK exports proposed payment stream functions
    expect(ctx.ocp.PaymentStreams.proposedPaymentStream.buildApproveCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.proposedPaymentStream.buildApproveCommand).toBe('function');

    expect(ctx.ocp.PaymentStreams.proposedPaymentStream.buildStartPaymentStreamCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.proposedPaymentStream.buildStartPaymentStreamCommand).toBe('function');

    expect(ctx.ocp.PaymentStreams.proposedPaymentStream.buildEditPaymentStreamProposalCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.proposedPaymentStream.buildEditPaymentStreamProposalCommand).toBe('function');

    expect(ctx.ocp.PaymentStreams.proposedPaymentStream.buildWithdrawCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.proposedPaymentStream.buildWithdrawCommand).toBe('function');
  });

  test.skip('full proposed payment stream workflow - requires payment infrastructure', async () => {
    // This test would require:
    // 1. Have an existing proposed payment stream
    // 2. Approve the proposal
    // 3. Start the payment stream
    //
    // Skipped as it requires full Canton Network with payment stream support
  });
});
