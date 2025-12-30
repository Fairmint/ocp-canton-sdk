/**
 * Integration tests for PartyMigrationProposal operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Active or proposed payment streams with migration proposals
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

createIntegrationTestSuite('PartyMigrationProposal operations', (getContext) => {
  /**
   * NOTE: PartyMigrationProposal tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Existing party migration proposals
   * 3. Multiple parties with proper setup
   *
   * These tests verify the command building but may not execute successfully without the full Canton Network
   * infrastructure.
   */

  test('builds approve command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.partyMigrationProposal.buildApproveCommand({
      migrationProposalContractId: 'test-migration-proposal-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds migrate active payment stream command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.partyMigrationProposal.buildMigrateActivePaymentStreamCommand({
      migrationProposalContractId: 'test-migration-proposal-id',
      activePaymentStreamContractId: 'test-active-stream-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds migrate proposed payment stream command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.partyMigrationProposal.buildMigrateProposedPaymentStreamCommand({
      migrationProposalContractId: 'test-migration-proposal-id',
      proposedPaymentStreamContractId: 'test-proposed-stream-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds archive command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.partyMigrationProposal.buildArchiveCommand({
      migrationProposalContractId: 'test-migration-proposal-id',
    });

    expect(cmd).toBeDefined();
  });

  test.skip('full party migration workflow - requires payment infrastructure', async () => {
    // This test would require:
    // 1. Have an active or proposed payment stream
    // 2. Create migration proposal
    // 3. Approve the migration
    // 4. Execute the migration
    //
    // Skipped as it requires full Canton Network with payment stream support
  });
});
