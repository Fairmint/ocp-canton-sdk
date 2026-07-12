/** Compile-time contracts for schema-shaped canonical built declarations. */

import type {
  ContactInfo,
  ContactInfoWithoutName,
  OcfDocument,
  OcfIssuer,
  OcfStakeholderRelationshipChangeEvent,
  OcfStockClassConversionRatioAdjustment,
  OcfStockPlan,
  OcfVestingTerms,
  OcpClient,
  VestingCondition,
} from '../../dist';

async function assertCoreReaderInference(client: OcpClient): Promise<void> {
  const dedicatedDocument: OcfDocument = (await client.OpenCapTable.document.get({ contractId: 'document-contract' }))
    .data;
  const genericDocument: OcfDocument = (
    await client.OpenCapTable.getByObjectType({ objectType: 'DOCUMENT', contractId: 'document-contract' })
  ).data;
  const dedicatedIssuer: OcfIssuer = (await client.OpenCapTable.issuer.get({ contractId: 'issuer-contract' })).data;
  const genericIssuer: OcfIssuer = (
    await client.OpenCapTable.getByObjectType({ objectType: 'ISSUER', contractId: 'issuer-contract' })
  ).data;
  const dedicatedStockPlan: OcfStockPlan = (await client.OpenCapTable.stockPlan.get({ contractId: 'plan-contract' }))
    .data;
  const genericStockPlan: OcfStockPlan = (
    await client.OpenCapTable.getByObjectType({ objectType: 'STOCK_PLAN', contractId: 'plan-contract' })
  ).data;
  const dedicatedVestingTerms: OcfVestingTerms = (
    await client.OpenCapTable.vestingTerms.get({ contractId: 'vesting-contract' })
  ).data;
  const genericVestingTerms: OcfVestingTerms = (
    await client.OpenCapTable.getByObjectType({ objectType: 'VESTING_TERMS', contractId: 'vesting-contract' })
  ).data;

  void dedicatedDocument;
  void genericDocument;
  void dedicatedIssuer;
  void genericIssuer;
  void dedicatedStockPlan;
  void genericStockPlan;
  void dedicatedVestingTerms;
  void genericVestingTerms;
}

const pathDocument: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-path',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
  path: './agreement.pdf',
};
const uriDocument: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-uri',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
  uri: 'https://example.com/agreement.pdf',
};
const pathDocumentWithNullUri: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-path-null-uri',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
  path: './agreement.pdf',
  uri: null,
};
const uriDocumentWithNullPath: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-uri-null-path',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
  path: null,
  uri: 'https://example.com/agreement.pdf',
};
// @ts-expect-error built declarations require one document location
const documentWithoutLocation: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-neither',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
};
// @ts-expect-error built declarations forbid both document locations
const documentWithBothLocations: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-both',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
  path: './agreement.pdf',
  uri: 'https://example.com/agreement.pdf',
};
// @ts-expect-error built declarations require one real document location
const documentWithNullLocations: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-null-locations',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
  path: null,
  uri: null,
};

const stockPlan: OcfStockPlan = {
  object_type: 'STOCK_PLAN',
  id: 'plan-1',
  plan_name: '2026 Plan',
  initial_shares_reserved: '1000',
  stock_class_ids: ['class-1'],
};
const stockPlanWithEmptyClassIds: OcfStockPlan = {
  object_type: 'STOCK_PLAN',
  id: 'plan-empty',
  plan_name: 'Empty Plan',
  initial_shares_reserved: '0',
  // @ts-expect-error built declarations require a non-empty stock_class_ids tuple
  stock_class_ids: [],
};
const stockPlanWithDeprecatedClassId: OcfStockPlan = {
  object_type: 'STOCK_PLAN',
  id: 'plan-deprecated',
  plan_name: 'Deprecated Plan',
  initial_shares_reserved: '1000',
  stock_class_ids: ['class-1'],
  // @ts-expect-error built typed stock plans require canonical stock_class_ids
  stock_class_id: 'class-1',
};

const issuerWithoutSubdivision: OcfIssuer = {
  object_type: 'ISSUER',
  id: 'issuer-none',
  legal_name: 'No Subdivision Inc.',
  formation_date: '2026-01-01',
  country_of_formation: 'US',
};
// @ts-expect-error built declarations forbid both issuer subdivision fields
const issuerWithBothSubdivisions: OcfIssuer = {
  object_type: 'ISSUER',
  id: 'issuer-both',
  legal_name: 'Both Subdivisions Inc.',
  formation_date: '2026-01-01',
  country_of_formation: 'US',
  country_subdivision_of_formation: 'US-DE',
  country_subdivision_name_of_formation: 'Delaware',
};

const namedPhoneContact: ContactInfo = {
  name: { legal_name: 'Taylor' },
  phone_numbers: [],
};
// @ts-expect-error built named contacts require a contact collection
const namedContactWithoutCollection: ContactInfo = { name: { legal_name: 'Taylor' } };
const emailContact: ContactInfoWithoutName = { emails: [] };
// @ts-expect-error built contact info requires a contact collection
const contactWithoutCollection: ContactInfoWithoutName = {};

const startedRelationship: OcfStakeholderRelationshipChangeEvent = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'relationship-started',
  date: '2026-01-01',
  stakeholder_id: 'stakeholder-1',
  relationship_started: 'EMPLOYEE',
};
// @ts-expect-error built relationship changes require started or ended
const relationshipWithoutChange: OcfStakeholderRelationshipChangeEvent = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'relationship-neither',
  date: '2026-01-01',
  stakeholder_id: 'stakeholder-1',
};

const portionCondition: VestingCondition = {
  id: 'portion',
  portion: { numerator: '1', denominator: '4' },
  trigger: { type: 'VESTING_START_DATE' },
  next_condition_ids: [],
};
// @ts-expect-error built vesting conditions require portion or quantity
const conditionWithoutAmount: VestingCondition = {
  id: 'neither',
  trigger: { type: 'VESTING_START_DATE' },
  next_condition_ids: [],
};
// @ts-expect-error built vesting conditions forbid both portion and quantity
const conditionWithBothAmounts: VestingCondition = {
  id: 'both',
  portion: { numerator: '1', denominator: '4' },
  quantity: '250',
  trigger: { type: 'VESTING_START_DATE' },
  next_condition_ids: [],
};

const vestingTermsWithEmptyConditions: OcfVestingTerms = {
  object_type: 'VESTING_TERMS',
  id: 'vesting-terms-empty',
  name: 'Empty Vesting',
  description: 'Invalid empty condition list',
  allocation_type: 'CUMULATIVE_ROUNDING',
  // @ts-expect-error built declarations require a non-empty vesting_conditions tuple
  vesting_conditions: [],
};

// @ts-expect-error built adjustment declarations require the complete mechanism
const adjustmentWithoutMechanism: OcfStockClassConversionRatioAdjustment = {
  object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
  id: 'adjustment-1',
  date: '2026-01-01',
  stock_class_id: 'class-1',
};
const adjustmentWithBoardApproval: OcfStockClassConversionRatioAdjustment = {
  object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
  id: 'adjustment-board-approval',
  date: '2026-01-01',
  stock_class_id: 'class-1',
  new_ratio_conversion_mechanism: {
    type: 'RATIO_CONVERSION',
    conversion_price: { amount: '1', currency: 'USD' },
    ratio: { numerator: '1', denominator: '1' },
    rounding_type: 'NORMAL',
  },
  // @ts-expect-error built declarations exclude non-schema approval dates
  board_approval_date: '2026-01-02',
};
const adjustmentWithStockholderApproval: OcfStockClassConversionRatioAdjustment = {
  object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
  id: 'adjustment-stockholder-approval',
  date: '2026-01-01',
  stock_class_id: 'class-1',
  new_ratio_conversion_mechanism: {
    type: 'RATIO_CONVERSION',
    conversion_price: { amount: '1', currency: 'USD' },
    ratio: { numerator: '1', denominator: '1' },
    rounding_type: 'NORMAL',
  },
  // @ts-expect-error built declarations exclude non-schema approval dates
  stockholder_approval_date: '2026-01-02',
};

void pathDocument;
void uriDocument;
void pathDocumentWithNullUri;
void uriDocumentWithNullPath;
void documentWithoutLocation;
void documentWithBothLocations;
void documentWithNullLocations;
void stockPlan;
void stockPlanWithEmptyClassIds;
void stockPlanWithDeprecatedClassId;
void issuerWithoutSubdivision;
void issuerWithBothSubdivisions;
void namedPhoneContact;
void namedContactWithoutCollection;
void emailContact;
void contactWithoutCollection;
void startedRelationship;
void relationshipWithoutChange;
void portionCondition;
void conditionWithoutAmount;
void conditionWithBothAmounts;
void vestingTermsWithEmptyConditions;
void adjustmentWithoutMechanism;
void adjustmentWithBoardApproval;
void adjustmentWithStockholderApproval;
void assertCoreReaderInference;
