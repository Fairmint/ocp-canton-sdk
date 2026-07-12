import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { withdrawAuthorization } from '../../../src/functions/OpenCapTable/issuerAuthorization/withdrawAuthorization';
import type { SubmitAndWaitForTransactionTreeResponse } from '../../../src/types/common';

type SubmitTransactionTree = LedgerJsonApiClient['submitAndWaitForTransactionTree'];

describe('withdrawAuthorization', () => {
  let submitAndWaitForTransactionTree: jest.MockedFunction<SubmitTransactionTree>;
  let client: LedgerJsonApiClient;

  beforeEach(() => {
    submitAndWaitForTransactionTree = jest.fn<ReturnType<SubmitTransactionTree>, Parameters<SubmitTransactionTree>>();
    client = { submitAndWaitForTransactionTree } as unknown as LedgerJsonApiClient;
  });

  it('submits validated command parameters and preserves command context', async () => {
    const response = {
      transactionTree: {
        updateId: 'update-withdraw',
        eventsById: {},
      },
    } as unknown as SubmitAndWaitForTransactionTreeResponse;
    submitAndWaitForTransactionTree.mockResolvedValue(response);

    await expect(
      withdrawAuthorization(client, {
        issuerAuthorizationContractId: 'authorization-contract-id',
        systemOperatorParty: 'system-operator::1220deadbeef',
        context: { workflowId: 'withdraw-workflow', commandId: 'withdraw-command' },
      })
    ).resolves.toEqual({ updateId: 'update-withdraw', response });

    expect(submitAndWaitForTransactionTree).toHaveBeenCalledWith(
      expect.objectContaining({
        actAs: ['system-operator::1220deadbeef'],
        workflowId: 'withdraw-workflow',
        commandId: 'withdraw-command',
        commands: [
          expect.objectContaining({
            ExerciseCommand: expect.objectContaining({ contractId: 'authorization-contract-id' }),
          }),
        ],
      })
    );
  });

  it('rejects unknown and invalid command parameters before submission', async () => {
    await expect(
      withdrawAuthorization(client, {
        issuerAuthorizationContractId: 'authorization-contract-id',
        systemOperatorParty: 'system-operator::1220deadbeef',
        loger: {},
      } as never)
    ).rejects.toMatchObject({ name: 'OcpValidationError', fieldPath: 'withdrawAuthorization.loger' });
    await expect(
      withdrawAuthorization(client, {
        issuerAuthorizationContractId: '',
        systemOperatorParty: 'system-operator::1220deadbeef',
      })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'withdrawAuthorization.issuerAuthorizationContractId',
    });
    await expect(
      withdrawAuthorization(client, {
        issuerAuthorizationContractId: 'authorization-contract-id',
        systemOperatorParty: 'invalid party',
      })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'withdrawAuthorization.systemOperatorParty',
    });
    expect(submitAndWaitForTransactionTree).not.toHaveBeenCalled();
  });

  it('rejects accessors and proxies without invoking traps', async () => {
    const getter = jest.fn(() => 'authorization-contract-id');
    const accessorParams = { systemOperatorParty: 'system-operator::1220deadbeef' };
    Object.defineProperty(accessorParams, 'issuerAuthorizationContractId', { enumerable: true, get: getter });
    await expect(withdrawAuthorization(client, accessorParams as never)).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'withdrawAuthorization.issuerAuthorizationContractId',
    });
    expect(getter).not.toHaveBeenCalled();

    const trap = jest.fn(() => {
      throw new Error('proxy trap invoked');
    });
    const proxy = new Proxy({}, { get: trap, ownKeys: trap });
    await expect(withdrawAuthorization(client, proxy as never)).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'withdrawAuthorization',
    });
    expect(trap).not.toHaveBeenCalled();
    expect(submitAndWaitForTransactionTree).not.toHaveBeenCalled();
  });
});
