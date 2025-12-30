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

import { createIntegrationTestSuite, skipIfValidatorUnavailable } from '../setup';

createIntegrationTestSuite('PaymentStreamChangeProposal operations', (getContext) => {
  /**
   * NOTE: PaymentStreamChangeProposal tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Existing payment stream change proposals
   * 3. Payer and payee parties with proper setup
   *
   * These tests verify the command building but may not execute successfully without the full Canton Network
   * infrastructure.
   */

  test('builds approve command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildApproveCommand({
      changeProposalContractId: 'test-change-proposal-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds apply command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildApplyCommand({
      changeProposalContractId: 'test-change-proposal-id',
      activePaymentStreamContractId: 'test-active-stream-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds reject command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.paymentStreamChangeProposal.buildRejectCommand({
      changeProposalContractId: 'test-change-proposal-id',
    });

    expect(cmd).toBeDefined();
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
