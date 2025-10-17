/** Utilities for building payment context for paymentStream payments */

import type { ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { getCurrentMiningRoundContext } from '@fairmint/canton-node-sdk/build/src/utils/mining/mining-rounds';
import type { OcpClient } from '../../../OcpClient';

export interface PaymentContext {
  amuletRulesCid: string;
  openMiningRoundCid: string;
  featuredAppRight: string | null;
}

export interface PaymentContextWithDisclosedContracts {
  paymentContext: PaymentContext;
  disclosedContracts: DisclosedContract[];
}

export interface PaymentContextWithAmulets {
  payerAmulets: string[];
  amuletRulesCid: string;
  openMiningRoundCid: string;
  featuredAppRight?: string | null;
}

export interface PaymentContextWithAmuletsAndDisclosed {
  paymentContext: PaymentContextWithAmulets;
  disclosedContracts: DisclosedContract[];
}

/**
 * Build payment context for processing paymentStream payments (no amulet inputs needed)
 *
 * Queries the ledger for:
 *
 * - AmuletRules contract
 * - OpenMiningRound contract
 * - FeaturedAppRight contract (if provider specified)
 *
 * Returns both the payment context and the disclosed contracts needed
 *
 * @param validatorClient - Validator API client for getting rules/rounds
 * @param provider - Optional provider party ID to lookup featured app right
 */
export async function buildPaymentContext(
  validatorClient: ValidatorApiClient,
  provider: string
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
  const { openMiningRoundContract } = miningRoundContext;

  // Get FeaturedAppRight contract if provider specified
  let featuredAppRightCid: string | null = null;
  const disclosedContracts: DisclosedContract[] = [amuletRulesContract, openMiningRoundContract];

  if (provider) {
    try {
      const featuredAppRight = await validatorClient.lookupFeaturedAppRight({ partyId: provider });
      if (featuredAppRight.featured_app_right) {
        // Extract the contract ID - it might be nested in the response
        featuredAppRightCid = typeof featuredAppRight.featured_app_right === 'string'
          ? featuredAppRight.featured_app_right
          : featuredAppRight.featured_app_right.contract_id || featuredAppRight.featured_app_right;
        
        // Add disclosed contract with synchronizer from amulet rules
        if (featuredAppRightCid) {
          disclosedContracts.push({
            templateId: featuredAppRight.featured_app_right.template_id,
            contractId: featuredAppRightCid,
            createdEventBlob: featuredAppRight.featured_app_right.created_event_blob,
            synchronizerId: amuletRulesResponse.amulet_rules.domain_id,
          });
        }
      }
    } catch {
      // If featured app right lookup fails, continue with null (optional)
      // This is expected when the provider doesn't have a featured app right
    }
  }

  return {
    paymentContext: {
      amuletRulesCid,
      openMiningRoundCid,
      featuredAppRight: featuredAppRightCid,
    },
    disclosedContracts,
  };
}

/**
 * Build payment context with payer's amulets for initial paymentStream approval
 *
 * Queries the ledger for:
 *
 * - Payer's Amulet contracts (via Validator API)
 * - AmuletRules contract
 * - OpenMiningRound contract
 * - FeaturedAppRight contract (if provider specified)
 *
 * Returns both the payment context and the disclosed contracts needed
 *
 * NOTE: The validatorClient must be authenticated as the payerParty
 *
 * @param ledgerClient - OCP client for querying contracts
 * @param validatorClient - Validator API client authenticated as payer
 * @param payerParty - Party ID of the payer (for validation only)
 * @param maxAmuletInputs - Maximum number of Amulet contracts to use (default: 2)
 * @param provider - Optional provider party ID to lookup featured app right
 */
export async function buildPaymentContextWithAmulets(
  ledgerClient: OcpClient,
  validatorClient: ValidatorApiClient,
  payerParty: string,
  maxAmuletInputs = 2,
  provider?: string
): Promise<PaymentContextWithAmuletsAndDisclosed> {
  // Get payer's Amulet contracts via Validator API
  // Note: validatorClient must be authenticated as payerParty
  const amuletsResponse = await validatorClient.getAmulets();

  const payerAmulets = amuletsResponse.amulets.map((amulet) => ({
    contractId: amulet.contract.contract.contract_id,
    templateId: amulet.contract.contract.template_id,
    synchronizerId: amulet.contract.domain_id,
  }));

  if (payerAmulets.length === 0) {
    throw new Error(`Payer ${payerParty} has no Amulet contracts`);
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
  const { openMiningRoundContract } = miningRoundContext;

  // Build payment context with amulets
  const amuletInputs = payerAmulets.slice(0, maxAmuletInputs).map((a) => a.contractId);

  // Get FeaturedAppRight contract if provider specified
  let featuredAppRightCid: string | null = null;
  const disclosedContracts: DisclosedContract[] = [
    amuletRulesContract,
    openMiningRoundContract,
    ...amuletDisclosedContracts,
  ];

  if (provider) {
    try {
      const featuredAppRight = await validatorClient.lookupFeaturedAppRight({ partyId: provider });
      if (featuredAppRight.featured_app_right) {
        // Extract the contract ID - it might be nested in the response
        featuredAppRightCid = typeof featuredAppRight.featured_app_right === 'string'
          ? featuredAppRight.featured_app_right
          : featuredAppRight.featured_app_right.contract_id || featuredAppRight.featured_app_right;
        
        // Add disclosed contract with synchronizer from amulet rules
        if (featuredAppRightCid) {
          disclosedContracts.push({
            templateId: featuredAppRight.featured_app_right.template_id,
            contractId: featuredAppRightCid,
            createdEventBlob: featuredAppRight.featured_app_right.created_event_blob,
            synchronizerId: amuletRulesResponse.amulet_rules.domain_id,
          });
        }
      }
    } catch {
      // If featured app right lookup fails, continue with null (optional)
      // This is expected when the provider doesn't have a featured app right
    }
  }

  return {
    paymentContext: {
      payerAmulets: amuletInputs,
      amuletRulesCid,
      openMiningRoundCid,
      featuredAppRight: featuredAppRightCid,
    },
    disclosedContracts,
  };
}
