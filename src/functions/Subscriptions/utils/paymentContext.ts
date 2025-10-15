/**
 * Utilities for building payment context for subscription payments
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { getCurrentMiningRoundContext } from '@fairmint/canton-node-sdk/build/src/utils/mining/mining-rounds';
import type { ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { OcpClient } from '../../../OcpClient';

export interface PaymentContext {
  amuletRulesCid: string;
  openMiningRoundCid: string;
}

export interface PaymentContextWithDisclosedContracts {
  paymentContext: PaymentContext;
  disclosedContracts: DisclosedContract[];
}

export interface PaymentContextWithAmulets {
  subscriberAmulets: string[];
  amuletRulesCid: string;
  openMiningRoundCid: string;
}

export interface PaymentContextWithAmuletsAndDisclosed {
  paymentContext: PaymentContextWithAmulets;
  disclosedContracts: DisclosedContract[];
}

/**
 * Build payment context for processing subscription payments (no amulet inputs needed)
 * 
 * Queries the ledger for:
 * - AmuletRules contract
 * - OpenMiningRound contract
 * 
 * Returns both the payment context and the disclosed contracts needed
 * 
 * @param validatorClient - Validator API client for getting rules/rounds
 */
export async function buildPaymentContext(
  validatorClient: ValidatorApiClient
): Promise<PaymentContextWithDisclosedContracts> {
  // Get AmuletRules contract
  const amuletRulesResponse = await validatorClient.getAmuletRules();
  const amuletRulesCid = amuletRulesResponse.amulet_rules.contract.contract_id;
  const amuletRulesContract = {
    templateId: amuletRulesResponse.amulet_rules.contract.template_id,
    contractId: amuletRulesCid,
    createdEventBlob: amuletRulesResponse.amulet_rules.contract.created_event_blob,
    synchronizerId: amuletRulesResponse.amulet_rules.domain_id,
  };

  // Get OpenMiningRound contract
  const miningRoundContext = await getCurrentMiningRoundContext(validatorClient);
  const openMiningRoundCid = miningRoundContext.openMiningRound;
  const openMiningRoundContract = miningRoundContext.openMiningRoundContract;

  return {
    paymentContext: {
      amuletRulesCid,
      openMiningRoundCid,
    },
    disclosedContracts: [amuletRulesContract, openMiningRoundContract],
  };
}

/**
 * Build payment context with subscriber's amulets for initial subscription approval
 * 
 * Queries the ledger for:
 * - Subscriber's Amulet contracts (via Validator API)
 * - AmuletRules contract
 * - OpenMiningRound contract
 * 
 * Returns both the payment context and the disclosed contracts needed
 * 
 * NOTE: The validatorClient must be authenticated as the subscriberParty
 * 
 * @param ledgerClient - OCP client for querying contracts
 * @param validatorClient - Validator API client authenticated as subscriber
 * @param subscriberParty - Party ID of the subscriber (for validation only)
 * @param maxAmuletInputs - Maximum number of Amulet contracts to use (default: 2)
 */
export async function buildPaymentContextWithAmulets(
  ledgerClient: OcpClient,
  validatorClient: ValidatorApiClient,
  subscriberParty: string,
  maxAmuletInputs: number = 2
): Promise<PaymentContextWithAmuletsAndDisclosed> {
  // Get subscriber's Amulet contracts via Validator API
  // Note: validatorClient must be authenticated as subscriberParty
  const amuletsResponse = await validatorClient.getAmulets();

  const subscriberAmulets = amuletsResponse.amulets.map((amulet) => ({
    contractId: amulet.contract.contract.contract_id,
    templateId: amulet.contract.contract.template_id,
    synchronizerId: amulet.contract.domain_id,
  }));

  if (subscriberAmulets.length === 0) {
    throw new Error(`Subscriber ${subscriberParty} has no Amulet contracts`);
  }

  // Get disclosed contracts for each Amulet (getAmulets already includes created_event_blob)
  const amuletsToDisclose = amuletsResponse.amulets.slice(0, maxAmuletInputs);
  const amuletDisclosedContracts = amuletsToDisclose.map((amulet) => ({
    templateId: amulet.contract.contract.template_id,
    contractId: amulet.contract.contract.contract_id,
    createdEventBlob: amulet.contract.contract.created_event_blob,
    synchronizerId: amulet.contract.domain_id,
  }));

  // Get AmuletRules contract
  const amuletRulesResponse = await validatorClient.getAmuletRules();
  const amuletRulesCid = amuletRulesResponse.amulet_rules.contract.contract_id;
  const amuletRulesContract = {
    templateId: amuletRulesResponse.amulet_rules.contract.template_id,
    contractId: amuletRulesCid,
    createdEventBlob: amuletRulesResponse.amulet_rules.contract.created_event_blob,
    synchronizerId: amuletRulesResponse.amulet_rules.domain_id,
  };

  // Get OpenMiningRound contract
  const miningRoundContext = await getCurrentMiningRoundContext(validatorClient);
  const openMiningRoundCid = miningRoundContext.openMiningRound;
  const openMiningRoundContract = miningRoundContext.openMiningRoundContract;

  // Build payment context with amulets
  const amuletInputs = subscriberAmulets.slice(0, maxAmuletInputs).map((a) => a.contractId);

  return {
    paymentContext: {
      subscriberAmulets: amuletInputs,
      amuletRulesCid,
      openMiningRoundCid,
    },
    disclosedContracts: [amuletRulesContract, openMiningRoundContract, ...amuletDisclosedContracts],
  };
}

