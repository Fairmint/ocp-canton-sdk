/**
 * Integration tests for IssuerAuthorization operations.
 *
 * Tests the authorization workflow:
 *
 * - Authorize issuer
 * - Withdraw authorization
 *
 * Run with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 */

import { createIntegrationTestSuite, skipIfValidatorUnavailable } from '../setup';

createIntegrationTestSuite('IssuerAuthorization operations', (getContext) => {
  test('authorizes an issuer', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    // The setupTestIssuer already uses authorizeIssuer internally,
    // but let's test the direct API call
    const authResult = await ctx.ocp.OpenCapTable.issuerAuthorization.authorizeIssuer({
      issuer: ctx.issuerParty,
    });

    expect(authResult.contractId).toBeDefined();
    expect(authResult.templateId).toBeDefined();
    expect(authResult.createdEventBlob).toBeDefined();
    expect(authResult.synchronizerId).toBeDefined();
  });

  test('withdraws authorization', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    // First authorize
    const authResult = await ctx.ocp.OpenCapTable.issuerAuthorization.authorizeIssuer({
      issuer: ctx.issuerParty,
    });

    // Then withdraw
    const withdrawResult = await ctx.ocp.OpenCapTable.issuerAuthorization.withdrawAuthorization({
      issuerAuthorizationContractId: authResult.contractId,
      issuer: ctx.issuerParty,
    });

    expect(withdrawResult.updateId).toBeDefined();
  });

  test('can re-authorize after withdrawal', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    // Authorize
    const authResult1 = await ctx.ocp.OpenCapTable.issuerAuthorization.authorizeIssuer({
      issuer: ctx.issuerParty,
    });

    // Withdraw
    await ctx.ocp.OpenCapTable.issuerAuthorization.withdrawAuthorization({
      issuerAuthorizationContractId: authResult1.contractId,
      issuer: ctx.issuerParty,
    });

    // Re-authorize
    const authResult2 = await ctx.ocp.OpenCapTable.issuerAuthorization.authorizeIssuer({
      issuer: ctx.issuerParty,
    });

    expect(authResult2.contractId).toBeDefined();
    expect(authResult2.contractId).not.toBe(authResult1.contractId);
  });
});
