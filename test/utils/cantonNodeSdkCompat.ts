/**
 * Compatibility for @fairmint/canton-node-sdk API changes: Ledger/Validator clients historically accepted
 * {@link ClientConfig} directly; newer releases require a shared {@link CantonRuntime}.
 *
 * This module resolves the active SDK shape at runtime so the same sources typecheck and run against both.
 */
import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient, ValidatorApiClient } from '@fairmint/canton-node-sdk';

function loadActualCantonSdkModule(): typeof import('@fairmint/canton-node-sdk') {
  if (typeof jest !== 'undefined' && typeof jest.requireActual === 'function') {
    return jest.requireActual<typeof import('@fairmint/canton-node-sdk')>('@fairmint/canton-node-sdk');
  }

  return require('@fairmint/canton-node-sdk') as typeof import('@fairmint/canton-node-sdk');
}

/**
 * Returns a {@link CantonRuntime} when the installed SDK provides it; otherwise returns `config` for legacy ctor args.
 * When using runtimes, reuse one instance for all clients that should share auth state.
 */
export function createCantonRuntimeOrConfig(config: ClientConfig): unknown {
  const sdk = loadActualCantonSdkModule();
  if ('CantonRuntime' in sdk) {
    const Ctor = (sdk as { CantonRuntime: new (c: ClientConfig) => unknown }).CantonRuntime;
    if (typeof Ctor === 'function') {
      return new Ctor(config);
    }
  }
  return config;
}

export function createLedgerJsonApiClient(config: ClientConfig): LedgerJsonApiClient {
  return new LedgerJsonApiClient(createCantonRuntimeOrConfig(config) as never);
}

export function createValidatorApiClient(config: ClientConfig): ValidatorApiClient {
  return new ValidatorApiClient(createCantonRuntimeOrConfig(config) as never);
}

export function createLedgerAndValidatorClients(config: ClientConfig): {
  ledger: LedgerJsonApiClient;
  validator: ValidatorApiClient;
} {
  const shared = createCantonRuntimeOrConfig(config);
  return {
    ledger: new LedgerJsonApiClient(shared as never),
    validator: new ValidatorApiClient(shared as never),
  };
}
