/** Compile-time contracts for schema-shaped canonical source DTOs. */

import type {
  ContactInfo,
  ContactInfoWithoutName,
  OcfDocument,
  OcfIssuer,
  OcfStakeholderRelationshipChangeEvent,
  OcfStockClassConversionRatioAdjustment,
  OcfStockPlan,
  VestingCondition,
} from '../../src';

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
// @ts-expect-error a document requires one location
const documentWithoutLocation: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-neither',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
};
// @ts-expect-error a document cannot have both locations
const documentWithBothLocations: OcfDocument = {
  object_type: 'DOCUMENT',
  id: 'document-both',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
  path: './agreement.pdf',
  uri: 'https://example.com/agreement.pdf',
};
// @ts-expect-error null locations do not satisfy the real-location requirement
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
  // @ts-expect-error stock_class_ids is schema-non-empty
  stock_class_ids: [],
};

const issuerWithoutSubdivision: OcfIssuer = {
  object_type: 'ISSUER',
  id: 'issuer-none',
  legal_name: 'No Subdivision Inc.',
  formation_date: '2026-01-01',
  country_of_formation: 'US',
};
// @ts-expect-error issuer subdivision code and name are mutually exclusive
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
// @ts-expect-error a named contact requires a phone or email collection
const namedContactWithoutCollection: ContactInfo = { name: { legal_name: 'Taylor' } };
const emailContact: ContactInfoWithoutName = { emails: [] };
// @ts-expect-error contact info requires a phone or email collection
const contactWithoutCollection: ContactInfoWithoutName = {};

const startedRelationship: OcfStakeholderRelationshipChangeEvent = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'relationship-started',
  date: '2026-01-01',
  stakeholder_id: 'stakeholder-1',
  relationship_started: 'EMPLOYEE',
};
// @ts-expect-error a relationship change requires a started or ended relationship
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
// @ts-expect-error a vesting condition requires portion or quantity
const conditionWithoutAmount: VestingCondition = {
  id: 'neither',
  trigger: { type: 'VESTING_START_DATE' },
  next_condition_ids: [],
};
// @ts-expect-error a vesting condition cannot have both portion and quantity
const conditionWithBothAmounts: VestingCondition = {
  id: 'both',
  portion: { numerator: '1', denominator: '4' },
  quantity: '250',
  trigger: { type: 'VESTING_START_DATE' },
  next_condition_ids: [],
};

// @ts-expect-error the canonical adjustment requires its complete mechanism
const adjustmentWithoutMechanism: OcfStockClassConversionRatioAdjustment = {
  object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
  id: 'adjustment-1',
  date: '2026-01-01',
  stock_class_id: 'class-1',
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
void adjustmentWithoutMechanism;
