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
   * These tests verify the command building but may not execute successfully without the full Canton Network
   * infrastructure.
   */

  test('builds approve command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.proposedPaymentStream.buildApproveCommand({
      proposedPaymentStreamContractId: 'test-proposed-stream-id',
    });

    expect(cmd).toBeDefined();
    expect(cmd.command).toBeDefined();
  });

  test('builds start payment stream command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.proposedPaymentStream.buildStartPaymentStreamCommand({
      proposedPaymentStreamContractId: 'test-proposed-stream-id',
      provider: ctx.issuerParty,
    });

    expect(cmd).toBeDefined();
    expect(cmd.command).toBeDefined();
  });

  test('builds edit payment stream proposal command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.proposedPaymentStream.buildEditPaymentStreamProposalCommand({
      proposedPaymentStreamContractId: 'test-proposed-stream-id',
      newStreamName: 'Updated Stream Name',
    });

    expect(cmd).toBeDefined();
  });

  test('builds withdraw command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.proposedPaymentStream.buildWithdrawCommand({
      proposedPaymentStreamContractId: 'test-proposed-stream-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds change party command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.proposedPaymentStream.buildChangePartyCommand({
      proposedPaymentStreamContractId: 'test-proposed-stream-id',
      newParty: ctx.issuerParty,
      isPayerChange: true,
    });

    expect(cmd).toBeDefined();
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
