/**
 * CantonPayments integration: **airdrop** (full-featured) vs **simpleAirdrop** (lighter-weight) command builders.
 *
 * All methods return `Command` (or `CommandWithDisclosedContracts` for join) for you to submit via
 * {@link OcpClient.createBatch} or the ledger client—nothing is executed inside the SDK.
 *
 * @example
 * ```typescript
 * const cmd = ocp.CantonPayments.airdrop.buildCreateAirdropCommand(params);
 * await ocp.createBatch({ actAs: [operatorParty] }).addCommand(cmd).submitAndWaitForTransactionTree();
 * ```
 */
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import {
  buildAddObserversToAirdropCommand,
  buildCreateAirdropCommand,
  buildExecuteAirdropCommand,
  buildJoinAirdropCommand,
  buildUpdateAirdropConfigCommand,
  type AddObserversToAirdropParams,
  type CreateAirdropParams,
  type ExecuteAirdropParams,
  type JoinAirdropParams,
  type UpdateAirdropConfigParams,
} from '../functions/CantonPayments/airdrop';
import {
  buildArchiveSimpleAirdropCommand,
  buildCreateSimpleAirdropCommand,
  buildExecuteSimpleAirdropCommand,
  type ArchiveSimpleAirdropParams,
  type CreateSimpleAirdropParams,
  type ExecuteSimpleAirdropParams,
} from '../functions/CantonPayments/simpleAirdrop';
import type { CommandWithDisclosedContracts } from '../types';

/** CantonPayments extension interface */
export interface CantonPaymentsMethods {
  airdrop: {
    buildCreateAirdropCommand: (params: CreateAirdropParams) => Command;
    buildUpdateAirdropConfigCommand: (params: UpdateAirdropConfigParams) => Command;
    buildAddObserversToAirdropCommand: (params: AddObserversToAirdropParams) => Command;
    buildJoinAirdropCommand: (params: JoinAirdropParams) => CommandWithDisclosedContracts;
    buildExecuteAirdropCommand: (params: ExecuteAirdropParams) => Command;
  };
  simpleAirdrop: {
    buildCreateSimpleAirdropCommand: (params: CreateSimpleAirdropParams) => Command;
    buildArchiveSimpleAirdropCommand: (params: ArchiveSimpleAirdropParams) => Command;
    buildExecuteSimpleAirdropCommand: (params: ExecuteSimpleAirdropParams) => Command;
  };
}

/** Creates the CantonPayments extension methods */
export function createCantonPaymentsExtension(): CantonPaymentsMethods {
  return {
    airdrop: {
      buildCreateAirdropCommand,
      buildUpdateAirdropConfigCommand,
      buildAddObserversToAirdropCommand,
      buildJoinAirdropCommand,
      buildExecuteAirdropCommand,
    },
    simpleAirdrop: {
      buildCreateSimpleAirdropCommand,
      buildArchiveSimpleAirdropCommand,
      buildExecuteSimpleAirdropCommand,
    },
  };
}
