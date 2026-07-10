import type {
  OcfConvertibleIssuance,
  OcfConvertibleTransfer,
  OcfEquityCompensationIssuance,
  OcfEquityCompensationTransfer,
  OcfFinancing,
  OcfPlanSecurityIssuance,
  OcfPlanSecurityTransfer,
  OcfStockConsolidation,
  OcfStockIssuance,
  OcfStockPlan,
  OcfStockTransfer,
  OcfVestingTerms,
  OcfWarrantIssuance,
  OcfWarrantTransfer,
} from '../../src/types/native';

const stockPlanEmptyStockClassIds: Pick<OcfStockPlan, 'stock_class_ids'> = {
  // @ts-expect-error stock_class_ids requires at least one item
  stock_class_ids: [],
};
const vestingTermsEmptyConditions: Pick<OcfVestingTerms, 'vesting_conditions'> = {
  // @ts-expect-error vesting_conditions requires at least one item
  vesting_conditions: [],
};
const financingEmptyIssuanceIds: Pick<OcfFinancing, 'issuance_ids'> = {
  // @ts-expect-error issuance_ids requires at least one item
  issuance_ids: [],
};
const convertibleIssuanceEmptyTriggers: Pick<OcfConvertibleIssuance, 'conversion_triggers'> = {
  // @ts-expect-error conversion_triggers requires at least one item
  conversion_triggers: [],
};
const stockIssuanceEmptyVestings: Pick<OcfStockIssuance, 'vestings'> = {
  // @ts-expect-error when present, vestings requires at least one item
  vestings: [],
};
const equityCompensationIssuanceEmptyVestings: Pick<OcfEquityCompensationIssuance, 'vestings'> = {
  // @ts-expect-error when present, vestings requires at least one item
  vestings: [],
};
const warrantIssuanceEmptyVestings: Pick<OcfWarrantIssuance, 'vestings'> = {
  // @ts-expect-error when present, vestings requires at least one item
  vestings: [],
};
const stockTransferEmptyResults: Pick<OcfStockTransfer, 'resulting_security_ids'> = {
  // @ts-expect-error resulting_security_ids requires at least one item
  resulting_security_ids: [],
};
const warrantTransferEmptyResults: Pick<OcfWarrantTransfer, 'resulting_security_ids'> = {
  // @ts-expect-error resulting_security_ids requires at least one item
  resulting_security_ids: [],
};
const convertibleTransferEmptyResults: Pick<OcfConvertibleTransfer, 'resulting_security_ids'> = {
  // @ts-expect-error resulting_security_ids requires at least one item
  resulting_security_ids: [],
};
const equityCompensationTransferEmptyResults: Pick<OcfEquityCompensationTransfer, 'resulting_security_ids'> = {
  // @ts-expect-error resulting_security_ids requires at least one item
  resulting_security_ids: [],
};
const stockConsolidationEmptySecurityIds: Pick<OcfStockConsolidation, 'security_ids'> = {
  // @ts-expect-error security_ids requires at least one item
  security_ids: [],
};

// These deprecated aliases remain root-exported and inherit the same pinned constraints.
const planSecurityIssuanceEmptyVestings: Pick<OcfPlanSecurityIssuance, 'vestings'> = {
  // @ts-expect-error when present, vestings requires at least one item
  vestings: [],
};
const planSecurityTransferEmptyResults: Pick<OcfPlanSecurityTransfer, 'resulting_security_ids'> = {
  // @ts-expect-error resulting_security_ids requires at least one item
  resulting_security_ids: [],
};

void stockPlanEmptyStockClassIds;
void vestingTermsEmptyConditions;
void financingEmptyIssuanceIds;
void convertibleIssuanceEmptyTriggers;
void stockIssuanceEmptyVestings;
void equityCompensationIssuanceEmptyVestings;
void warrantIssuanceEmptyVestings;
void stockTransferEmptyResults;
void warrantTransferEmptyResults;
void convertibleTransferEmptyResults;
void equityCompensationTransferEmptyResults;
void stockConsolidationEmptySecurityIds;
void planSecurityIssuanceEmptyVestings;
void planSecurityTransferEmptyResults;
