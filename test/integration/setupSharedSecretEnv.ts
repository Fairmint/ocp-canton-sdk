/**
 * Force shared-secret LocalNet auth for Dev Tools test helpers.
 *
 * `buildIntegrationTestClientConfig` defaults to OAuth2 unless
 * `FAIRMINT_TEST_SHARED_SECRET` (or other FAIRMINT_TEST_* auth overrides) is set.
 * OCP LocalNet CI uses shared-secret (`CANTON_LOCALNET_AUTH_MODE=shared-secret`).
 */
process.env.FAIRMINT_TEST_SHARED_SECRET ??=
  process.env.OCP_TEST_SHARED_SECRET && process.env.OCP_TEST_SHARED_SECRET.length > 0
    ? process.env.OCP_TEST_SHARED_SECRET
    : 'unsafe';
