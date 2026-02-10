/**
 * Integration tests for IssuerAuthorization operations.
 *
 * Tests the authorization workflow:
 *
 * - Authorize issuer using the dynamically deployed factory
 * - Withdraw authorization
 * - Re-authorize after withdrawal
 *
 * Note: These tests use authorizeIssuerWithFactory from the test harness rather than the SDK's authorizeIssuer, because
 * the SDK's version reads factory contract IDs from a JSON file that only has devnet/mainnet entries. LocalNet requires
 * the dynamically deployed factory from the test harness.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';
import { authorizeIssuerWithFactory } from '../setup/contractDeployment';

createIntegrationTestSuite('IssuerAuthorization operations', (getContext) => {
  test('authorizes an issuer using the harness factory', async () => {
    const ctx = getContext();

    // Use authorizeIssuerWithFactory which uses the dynamically deployed factory
    // The SDK's authorizeIssuer would fail with "Unsupported network: localnet"
    const authResult = await authorizeIssuerWithFactory(
      ctx.ocp.client,
      ctx.ocpFactoryContractId,
      ctx.systemOperatorParty,
      ctx.issuerParty
    );

    expect(authResult.contractId).toBeDefined();
    expect(authResult.templateId).toBeDefined();
    expect(authResult.createdEventBlob).toBeDefined();
    expect(authResult.synchronizerId).toBeDefined();
  });

  test('withdraws authorization', async () => {
    const ctx = getContext();

    // First authorize using the harness factory
    const authResult = await authorizeIssuerWithFactory(
      ctx.ocp.client,
      ctx.ocpFactoryContractId,
      ctx.systemOperatorParty,
      ctx.issuerParty
    );

    // Then withdraw - use systemOperatorParty since they own the authorization
    const withdrawResult = await ctx.ocp.OpenCapTable.issuerAuthorization.withdraw({
      issuerAuthorizationContractId: authResult.contractId,
      systemOperatorParty: ctx.systemOperatorParty,
    });

    expect(withdrawResult.updateId).toBeDefined();
  });

  test('can re-authorize after withdrawal', async () => {
    const ctx = getContext();

    // Authorize using the harness factory
    const authResult1 = await authorizeIssuerWithFactory(
      ctx.ocp.client,
      ctx.ocpFactoryContractId,
      ctx.systemOperatorParty,
      ctx.issuerParty
    );

    // Withdraw - use systemOperatorParty
    await ctx.ocp.OpenCapTable.issuerAuthorization.withdraw({
      issuerAuthorizationContractId: authResult1.contractId,
      systemOperatorParty: ctx.systemOperatorParty,
    });

    // Re-authorize using the harness factory
    const authResult2 = await authorizeIssuerWithFactory(
      ctx.ocp.client,
      ctx.ocpFactoryContractId,
      ctx.systemOperatorParty,
      ctx.issuerParty
    );

    expect(authResult2.contractId).toBeDefined();
    expect(authResult2.contractId).not.toBe(authResult1.contractId);
  });
});
