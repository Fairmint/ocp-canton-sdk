/**
 * Utilities for building payment context for subscription payments
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { getCurrentMiningRoundContext } from '@fairmint/canton-node-sdk/build/src/utils/mining/mining-rounds';
import type { ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { OcpClient } from '../../../OcpClient';

export interface PaymentContext {
  amuletInputs: string[];
  amuletRulesCid: string;
  openMiningRoundCid: string;
}

export interface PaymentContextWithDisclosedContracts {
  paymentContext: PaymentContext;
  disclosedContracts: DisclosedContract[];
}

/**
 * Build payment context for a subscription payment
 * 
 * Queries the ledger for:
 * - Subscriber's Amulet contracts
 * - AmuletRules contract
 * - OpenMiningRound contract
 * 
 * Returns both the payment context and the disclosed contracts needed
 * 
 * @param ledgerClient - OCP client for querying contracts
 * @param validatorClient - Validator API client for getting rules/rounds
 * @param subscriberParty - Party ID of the subscriber (who owns the Amulets)
 * @param maxAmuletInputs - Maximum number of Amulet contracts to use (default: 2)
 */
export async function buildPaymentContext(
  ledgerClient: OcpClient,
  validatorClient: ValidatorApiClient,
  subscriberParty: string,
  maxAmuletInputs: number = 2
): Promise<PaymentContextWithDisclosedContracts> {
  // Get subscriber's Amulet contracts
  const subscriberContracts = await getAllActiveContracts(ledgerClient, [subscriberParty]);

  const subscriberAmulets = subscriberContracts
    .filter((msg) => {
      if (msg.contractEntry && msg.contractEntry.JsActiveContract) {
        const { createdEvent } = msg.contractEntry.JsActiveContract;
        const { templateId } = createdEvent;
        return (
          templateId.moduleName === 'Splice.Amulet' &&
          templateId.entityName === 'Amulet' &&
          createdEvent.createArgument &&
          'amount' in createdEvent.createArgument
        );
      }
      return false;
    })
    .map((msg) => ({
      contractId: msg.contractEntry.JsActiveContract.createdEvent.contractId,
      templateId: msg.contractEntry.JsActiveContract.createdEvent.templateId,
      payload: msg.contractEntry.JsActiveContract.createdEvent.createArgument,
      synchronizerId: msg.contractEntry.JsActiveContract.synchronizerId,
    }));

  if (subscriberAmulets.length === 0) {
    throw new Error(`Subscriber ${subscriberParty} has no Amulet contracts`);
  }

  // Get disclosed contracts for each Amulet
  const amuletDisclosedContracts = await Promise.all(
    subscriberAmulets.slice(0, maxAmuletInputs).map(async (amulet) => {
      const amuletEvents = await ledgerClient.client.getEventsByContractId({
        contractId: amulet.contractId,
      });

      if (!amuletEvents.created?.createdEvent) {
        throw new Error(`Amulet contract ${amulet.contractId} not found`);
      }

      return {
        templateId: amuletEvents.created.createdEvent.templateId,
        contractId: amuletEvents.created.createdEvent.contractId,
        createdEventBlob: amuletEvents.created.createdEvent.createdEventBlob,
        synchronizerId: amuletEvents.created.synchronizerId,
      };
    })
  );

  // Get AmuletRules contract
  const amuletRulesResponse = await validatorClient.getAmuletRules();
  const amuletRulesCid = amuletRulesResponse.amulet_rules.contract.contract_id;
  const amuletRulesContract = {
    templateId: amuletRulesResponse.amulet_rules.contract.template_id,
    contractId: amuletRulesCid,
    createdEventBlob: amuletRulesResponse.amulet_rules.created_event_blob,
    synchronizerId: amuletRulesResponse.amulet_rules.synchronizer_id,
  };

  // Get OpenMiningRound contract
  const miningRoundContext = await getCurrentMiningRoundContext(validatorClient);
  const openMiningRoundCid = miningRoundContext.openMiningRound;
  const openMiningRoundContract = miningRoundContext.openMiningRoundContract;

  // Build payment context
  const amuletInputs = subscriberAmulets.slice(0, maxAmuletInputs).map((a) => a.contractId);

  return {
    paymentContext: {
      amuletInputs,
      amuletRulesCid,
      openMiningRoundCid,
    },
    disclosedContracts: [amuletRulesContract, openMiningRoundContract, ...amuletDisclosedContracts],
  };
}

/**
 * Helper to get all active contracts for a party using websocket streaming
 * (avoids the 200 item limit of the REST API)
 */
async function getAllActiveContracts(client: OcpClient, parties: string[]): Promise<any[]> {
  // Get current ledger end offset
  const ledgerEndResp = await client.client.getLedgerEnd({});
  const activeAtOffset = ledgerEndResp.offset;

  return new Promise((resolve, reject) => {
    const contracts: any[] = [];
    let subscription: any;

    client.client
      .subscribeToActiveContracts(
        {
          activeAtOffset,
          parties,
        },
        {
          onOpen: () => {
            // Connection opened
          },
          onMessage: (msg) => {
            // Collect active contracts
            if (typeof msg === 'object' && 'contractEntry' in msg && 'JsActiveContract' in msg.contractEntry) {
              contracts.push(msg);
            }
          },
          onError: (err) => {
            if (subscription) {
              subscription.close();
            }
            reject(err);
          },
          onClose: (code, reason) => {
            // All contracts have been streamed
            if (code === 1000) {
              // Normal closure
              resolve(contracts);
            } else {
              reject(new Error(`Websocket closed with code ${code}: ${reason}`));
            }
          },
        }
      )
      .then((sub) => {
        subscription = sub;
      })
      .catch(reject);
  });
}

