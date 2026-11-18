/**
 * The references an OCF record makes to other records and the register's per-record caps (a port of
 * `Fairmint.OpenCapTable.References`, with the record queries of `Fairmint.OpenCapTable.Restate` that inputs
 * resolution needs).
 *
 * Internal: these read the generated `OcfRecordData` a write carries, exactly as the ledger reads it, so they stay
 * behind the package boundary. `register.requirementsOf` is the native entry point.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/References.daml
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { ENTITY_REGISTRY, type OcfRecordDataTag } from '../functions/OpenCapTable/capTable/batchTypes';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import type { OcfObjectType } from '../types/native';
import type { RecordedSplit, RegisterRequirement } from '../types/register';
import { damlEnumConstructorFromInput, ocfEnumValue } from '../utils/damlEnums';
import { MAX_CLASSES_PER_STOCK_PLAN, MAX_STORED_POLYMORPHIC_REFERENCES, MAX_TRANCHES_PER_SECURITY } from './caps';

/** The generated `OcfRecordData` variant: one OCF record as a write carries it. */
export type RecordData = Fairmint.OpenCapTable.OcfRecords.OcfRecordData;
type CapitalizationDefinition = Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinition;
type AnyConversionRight = Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight;

const ENTITY_TYPE_BY_TAG: ReadonlyMap<OcfRecordDataTag, OcfEntityType> = new Map(
  (Object.entries(ENTITY_REGISTRY) as Array<[OcfEntityType, { recordTag: OcfRecordDataTag }]>).map(
    ([entityType, entry]) => [entry.recordTag, entityType]
  )
);

/** The entity kind of a record. */
export function recordEntityType(data: RecordData): OcfEntityType {
  const entityType = ENTITY_TYPE_BY_TAG.get(data.tag);
  if (entityType === undefined) throw new Error(`No entity kind for OcfRecordData constructor ${data.tag}`);
  return entityType;
}

/** The OCF object type of a record (`recordObjectType`). */
export function recordObjectType(data: RecordData): OcfObjectType {
  return ENTITY_REGISTRY[recordEntityType(data)].objectType;
}

/** An object type as the ledger shows it in a message: its `OcfObjectType` constructor. */
export function showObjectType(objectType: OcfObjectType): string {
  return damlEnumConstructorFromInput('OcfObjectType', objectType);
}

function showObjectTypes(objectTypes: readonly OcfObjectType[]): string {
  return `[${objectTypes.map(showObjectType).join(',')}]`;
}

/** The issuance object types, of every instrument (`issuanceObjectTypes`). */
export const ISSUANCE_OBJECT_TYPES: readonly OcfObjectType[] = [
  'TX_CONVERTIBLE_ISSUANCE',
  'TX_EQUITY_COMPENSATION_ISSUANCE',
  'TX_STOCK_ISSUANCE',
  'TX_WARRANT_ISSUANCE',
];

type RecordOf<Tag extends RecordData['tag']> = Extract<RecordData, { tag: Tag }>;

function hasTag<Tag extends RecordData['tag']>(data: RecordData, tags: readonly Tag[]): data is RecordOf<Tag> {
  return (tags as readonly string[]).includes(data.tag);
}

const ISSUANCE_TAGS = [
  'OcfRecordDataStockIssuance',
  'OcfRecordDataWarrantIssuance',
  'OcfRecordDataConvertibleIssuance',
  'OcfRecordDataEquityCompensationIssuance',
] as const;

/** The issuances that carry explicit vesting tranches. */
const VESTING_ISSUANCE_TAGS = [
  'OcfRecordDataStockIssuance',
  'OcfRecordDataWarrantIssuance',
  'OcfRecordDataEquityCompensationIssuance',
] as const;

/** The security ID an issuance record carries; other records carry none (`issuanceSecurityId`). */
export function issuanceSecurityId(data: RecordData): string | null {
  return hasTag(data, ISSUANCE_TAGS) ? data.value.security_id : null;
}

/** Vesting tranches a record carries, for the per-transaction tranche cap: every issuance's (`recordTranches`). */
export function recordTranches(data: RecordData): number {
  return hasTag(data, VESTING_ISSUANCE_TAGS) ? data.value.vestings.length : 0;
}

function capitalizationReferenceCount(definition: CapitalizationDefinition): number {
  return (
    definition.include_security_ids.length +
    definition.exclude_security_ids.length +
    definition.include_stock_class_ids.length +
    definition.include_stock_plans_ids.length
  );
}

/**
 * The register's size caps on one record, checked on every write (`checkRecordCaps`): the ledger's refusal, or `null`
 * when the record is within them.
 */
export function checkRecordCaps(data: RecordData): string | null {
  const cap = (what: string, count: number, limit: number): string | null =>
    count <= limit ? null : `${showObjectType(recordObjectType(data))} has ${count} ${what}; at most ${limit}`;
  if (data.tag === 'OcfRecordDataDocument') {
    return cap('document related objects', data.value.related_objects.length, MAX_STORED_POLYMORPHIC_REFERENCES);
  }
  if (data.tag === 'OcfRecordDataFinancing') {
    return cap('financing issuance IDs', data.value.issuance_ids.length, MAX_STORED_POLYMORPHIC_REFERENCES);
  }
  if (data.tag === 'OcfRecordDataConvertibleConversion') {
    return cap(
      'capitalization definition references',
      polymorphicReferenceCount(data),
      MAX_STORED_POLYMORPHIC_REFERENCES
    );
  }
  if (data.tag === 'OcfRecordDataStockPlan') {
    return cap('stock plan classes', data.value.stock_class_ids.length, MAX_CLASSES_PER_STOCK_PLAN);
  }
  if (hasTag(data, VESTING_ISSUANCE_TAGS)) {
    return cap('vesting tranches', data.value.vestings.length, MAX_TRANCHES_PER_SECURITY);
  }
  return null;
}

/** Polymorphic references a record makes; a transaction checks at most 100 (`polymorphicReferenceCount`). */
export function polymorphicReferenceCount(data: RecordData): number {
  if (data.tag === 'OcfRecordDataDocument') return data.value.related_objects.length;
  if (data.tag === 'OcfRecordDataFinancing') return data.value.issuance_ids.length;
  if (data.tag === 'OcfRecordDataConvertibleConversion' && data.value.capitalization_definition !== null) {
    return capitalizationReferenceCount(data.value.capitalization_definition);
  }
  return 0;
}

/** A key that two requirements share exactly when Daml's `Eq` holds them equal. */
export function requirementKey(requirement: RegisterRequirement): string {
  return JSON.stringify(requirement);
}

/** Requirements without repeats, each at its first position, as Daml's `dedup`. */
export function dedupRequirements(requirements: readonly RegisterRequirement[]): RegisterRequirement[] {
  const seen = new Set<string>();
  const unique: RegisterRequirement[] = [];
  for (const requirement of requirements) {
    const key = requirementKey(requirement);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(requirement);
  }
  return unique;
}

function objectRef(label: string, objectId: string, objectTypes: OcfObjectType[]): RegisterRequirement {
  return { kind: 'object', label, object_id: objectId, object_types: objectTypes };
}

function securityRef(label: string, objectType: OcfObjectType, securityId: string): RegisterRequirement {
  return { kind: 'security', label, security_id: securityId, object_types: [objectType] };
}

function optionalList<T>(value: T | null): T[] {
  return value === null ? [] : [value];
}

function documentRefs(
  references: readonly Fairmint.OpenCapTable.OCF.Document.OcfObjectReference[]
): RegisterRequirement[] {
  return references.map((reference) =>
    objectRef('Document related object', reference.object_id, [
      ocfEnumValue('OcfObjectType', reference.object_type, 'related_objects.object_type'),
    ])
  );
}

function financingRefs(issuanceIds: readonly string[]): RegisterRequirement[] {
  return issuanceIds.map((id) => objectRef('Financing issuance', id, [...ISSUANCE_OBJECT_TYPES]));
}

function capitalizationRefs(label: string, definition: CapitalizationDefinition): RegisterRequirement[] {
  return [
    ...definition.include_security_ids.map((id): RegisterRequirement => ({
      kind: 'security',
      label: `${label} included security`,
      security_id: id,
      object_types: [...ISSUANCE_OBJECT_TYPES],
    })),
    ...definition.exclude_security_ids.map((id): RegisterRequirement => ({
      kind: 'security',
      label: `${label} excluded security`,
      security_id: id,
      object_types: [...ISSUANCE_OBJECT_TYPES],
    })),
    ...definition.include_stock_class_ids.map((id) => objectRef(`${label} stock class`, id, ['STOCK_CLASS'])),
    ...definition.include_stock_plans_ids.map((id) => objectRef(`${label} stock plan`, id, ['STOCK_PLAN'])),
  ];
}

function conversionCapitalizationRefs(definition: CapitalizationDefinition | null): RegisterRequirement[] {
  return definition === null ? [] : capitalizationRefs('Convertible conversion capitalization definition', definition);
}

/**
 * The requirements of a record's polymorphic references, the ones the per-transaction cap counts
 * (`polymorphicRequirementsOf`): an edit is charged for those the old record did not make.
 */
export function polymorphicRequirementsOf(data: RecordData): RegisterRequirement[] {
  if (data.tag === 'OcfRecordDataDocument') return dedupRequirements(documentRefs(data.value.related_objects));
  if (data.tag === 'OcfRecordDataFinancing') return dedupRequirements(financingRefs(data.value.issuance_ids));
  if (data.tag === 'OcfRecordDataConvertibleConversion') {
    return dedupRequirements(conversionCapitalizationRefs(data.value.capitalization_definition));
  }
  return [];
}

function conversionRightTargets(label: string, right: AnyConversionRight): RegisterRequirement[] {
  return optionalList(right.value.converts_to_stock_class_id).map((id) =>
    objectRef(`${label} conversion target`, id, ['STOCK_CLASS'])
  );
}

const stakeholderRef = (label: string, id: string): RegisterRequirement => objectRef(label, id, ['STAKEHOLDER']);
const stockClassRef = (label: string, id: string): RegisterRequirement => objectRef(label, id, ['STOCK_CLASS']);
const stockPlanRef = (label: string, id: string): RegisterRequirement => objectRef(label, id, ['STOCK_PLAN']);
const vestingTermsRef = (label: string, id: string): RegisterRequirement => objectRef(label, id, ['VESTING_TERMS']);

/**
 * Every reference a record makes, as requirements on the write's working set (`requirementsOf`). Stock events on a
 * state need none for their source and outputs: the state proves the source, and the outputs are written in the same
 * operation with their own requirements.
 */
export function requirementsOfRecord(data: RecordData): RegisterRequirement[] {
  return dedupRequirements(rawRequirementsOf(data));
}

function rawRequirementsOf(data: RecordData): RegisterRequirement[] {
  switch (data.tag) {
    case 'OcfRecordDataConvertibleAcceptance':
      return [securityRef('Convertible acceptance', 'TX_CONVERTIBLE_ISSUANCE', data.value.security_id)];
    case 'OcfRecordDataConvertibleCancellation':
      return [
        securityRef('Convertible cancellation', 'TX_CONVERTIBLE_ISSUANCE', data.value.security_id),
        ...optionalList(data.value.balance_security_id).map((id) =>
          securityRef('Convertible cancellation balance', 'TX_CONVERTIBLE_ISSUANCE', id)
        ),
      ];
    case 'OcfRecordDataConvertibleConversion':
      return [
        securityRef('Convertible conversion', 'TX_CONVERTIBLE_ISSUANCE', data.value.security_id),
        {
          kind: 'trigger',
          label: 'Convertible conversion',
          security_id: data.value.security_id,
          trigger_id: data.value.trigger_id,
        },
        ...data.value.resulting_security_ids.map((id) =>
          securityRef('Convertible conversion resulting security', 'TX_STOCK_ISSUANCE', id)
        ),
        ...optionalList(data.value.balance_security_id).map((id) =>
          securityRef('Convertible conversion balance', 'TX_CONVERTIBLE_ISSUANCE', id)
        ),
        ...conversionCapitalizationRefs(data.value.capitalization_definition),
      ];
    case 'OcfRecordDataConvertibleIssuance':
      return [
        stakeholderRef('Convertible issuance stakeholder', data.value.stakeholder_id),
        ...data.value.conversion_triggers.flatMap((trigger) =>
          conversionRightTargets('Convertible conversion trigger', {
            tag: 'OcfRightConvertible',
            value: trigger.conversion_right,
          })
        ),
      ];
    case 'OcfRecordDataConvertibleRetraction':
      return [securityRef('Convertible retraction', 'TX_CONVERTIBLE_ISSUANCE', data.value.security_id)];
    case 'OcfRecordDataConvertibleTransfer':
      return [
        securityRef('Convertible transfer', 'TX_CONVERTIBLE_ISSUANCE', data.value.security_id),
        ...data.value.resulting_security_ids.map((id) =>
          securityRef('Convertible transfer resulting security', 'TX_CONVERTIBLE_ISSUANCE', id)
        ),
        ...optionalList(data.value.balance_security_id).map((id) =>
          securityRef('Convertible transfer balance', 'TX_CONVERTIBLE_ISSUANCE', id)
        ),
      ];
    case 'OcfRecordDataDocument':
      return documentRefs(data.value.related_objects);
    case 'OcfRecordDataEquityCompensationAcceptance':
      return [securityRef('Equity compensation acceptance', 'TX_EQUITY_COMPENSATION_ISSUANCE', data.value.security_id)];
    case 'OcfRecordDataEquityCompensationCancellation':
      return [
        securityRef('Equity compensation cancellation', 'TX_EQUITY_COMPENSATION_ISSUANCE', data.value.security_id),
        ...optionalList(data.value.balance_security_id).map((id) =>
          securityRef('Equity compensation cancellation balance', 'TX_EQUITY_COMPENSATION_ISSUANCE', id)
        ),
      ];
    case 'OcfRecordDataEquityCompensationExercise':
      return [
        securityRef('Equity compensation exercise', 'TX_EQUITY_COMPENSATION_ISSUANCE', data.value.security_id),
        ...data.value.resulting_security_ids.map((id) =>
          securityRef('Equity compensation exercise resulting security', 'TX_STOCK_ISSUANCE', id)
        ),
      ];
    case 'OcfRecordDataEquityCompensationIssuance': {
      const { stock_plan_id: plan, stock_class_id: stockClass } = data.value;
      return [
        stakeholderRef('Equity compensation stakeholder', data.value.stakeholder_id),
        ...optionalList(stockClass).map((id) => stockClassRef('Equity compensation stock class', id)),
        ...optionalList(data.value.vesting_terms_id).map((id) =>
          vestingTermsRef('Equity compensation vesting terms', id)
        ),
        ...(plan !== null && stockClass !== null
          ? [
              {
                kind: 'plan_includes_class' as const,
                label: 'Equity compensation stock plan',
                stock_plan_id: plan,
                stock_class_id: stockClass,
              },
            ]
          : plan !== null
            ? [stockPlanRef('Equity compensation stock plan', plan)]
            : []),
      ];
    }
    case 'OcfRecordDataEquityCompensationRelease':
      return [
        securityRef('Equity compensation release', 'TX_EQUITY_COMPENSATION_ISSUANCE', data.value.security_id),
        ...data.value.resulting_security_ids.map((id) =>
          securityRef('Equity compensation release resulting security', 'TX_STOCK_ISSUANCE', id)
        ),
      ];
    case 'OcfRecordDataEquityCompensationRepricing':
      return [securityRef('Equity compensation repricing', 'TX_EQUITY_COMPENSATION_ISSUANCE', data.value.security_id)];
    case 'OcfRecordDataEquityCompensationRetraction':
      return [securityRef('Equity compensation retraction', 'TX_EQUITY_COMPENSATION_ISSUANCE', data.value.security_id)];
    case 'OcfRecordDataEquityCompensationTransfer':
      return [
        securityRef('Equity compensation transfer', 'TX_EQUITY_COMPENSATION_ISSUANCE', data.value.security_id),
        ...data.value.resulting_security_ids.map((id) =>
          securityRef('Equity compensation transfer resulting security', 'TX_EQUITY_COMPENSATION_ISSUANCE', id)
        ),
        ...optionalList(data.value.balance_security_id).map((id) =>
          securityRef('Equity compensation transfer balance', 'TX_EQUITY_COMPENSATION_ISSUANCE', id)
        ),
      ];
    case 'OcfRecordDataFinancing':
      return financingRefs(data.value.issuance_ids);
    case 'OcfRecordDataIssuer':
      return [];
    case 'OcfRecordDataIssuerAuthorizedSharesAdjustment':
      return [objectRef('Issuer authorized shares adjustment issuer', data.value.issuer_id, ['ISSUER'])];
    case 'OcfRecordDataStakeholder':
      return [];
    case 'OcfRecordDataStakeholderRelationshipChangeEvent':
      return [stakeholderRef('Stakeholder relationship change event stakeholder', data.value.stakeholder_id)];
    case 'OcfRecordDataStakeholderStatusChangeEvent':
      return [stakeholderRef('Stakeholder status change event stakeholder', data.value.stakeholder_id)];
    case 'OcfRecordDataStockClass':
      return data.value.conversion_rights.flatMap((right) =>
        conversionRightTargets(`Stock class ${data.value.id}`, { tag: 'OcfRightStockClass', value: right })
      );
    case 'OcfRecordDataStockClassAuthorizedSharesAdjustment':
      return [stockClassRef('Stock class authorized shares adjustment', data.value.stock_class_id)];
    case 'OcfRecordDataStockClassConversionRatioAdjustment':
      return [
        {
          kind: 'ratio_conversion_right',
          label: `Stock class conversion ratio adjustment ${data.value.id}`,
          stock_class_id: data.value.stock_class_id,
        },
      ];
    case 'OcfRecordDataStockClassSplit':
      return [stockClassRef('Stock class split', data.value.stock_class_id)];
    case 'OcfRecordDataStockIssuance':
      return [
        stakeholderRef('Stock issuance stakeholder', data.value.stakeholder_id),
        stockClassRef('Stock issuance stock class', data.value.stock_class_id),
        ...data.value.stock_legend_ids.map((id) =>
          objectRef('Stock issuance stock legend', id, ['STOCK_LEGEND_TEMPLATE'])
        ),
        ...optionalList(data.value.stock_plan_id).map((id): RegisterRequirement => ({
          kind: 'plan_includes_class',
          label: 'Stock issuance stock plan',
          stock_plan_id: id,
          stock_class_id: data.value.stock_class_id,
        })),
        ...optionalList(data.value.vesting_terms_id).map((id) => vestingTermsRef('Stock issuance vesting terms', id)),
      ];
    case 'OcfRecordDataStockPlan':
      return data.value.stock_class_ids.map((id) => stockClassRef(`Stock plan ${data.value.id} stock class`, id));
    case 'OcfRecordDataStockPlanPoolAdjustment':
      return [stockPlanRef('Stock plan pool adjustment', data.value.stock_plan_id)];
    case 'OcfRecordDataStockPlanReturnToPool':
      return [stockPlanRef('Stock plan return to pool', data.value.stock_plan_id)];
    case 'OcfRecordDataValuation':
      return [stockClassRef('Valuation stock class', data.value.stock_class_id)];
    case 'OcfRecordDataVestingEvent':
      return [
        {
          kind: 'vesting_condition',
          label: `Vesting event ${data.value.id}`,
          security_id: data.value.security_id,
          vesting_condition_id: data.value.vesting_condition_id,
          start: false,
        },
      ];
    case 'OcfRecordDataVestingStart':
      return [
        {
          kind: 'vesting_condition',
          label: `Vesting start ${data.value.id}`,
          security_id: data.value.security_id,
          vesting_condition_id: data.value.vesting_condition_id,
          start: true,
        },
      ];
    case 'OcfRecordDataWarrantAcceptance':
      return [securityRef('Warrant acceptance', 'TX_WARRANT_ISSUANCE', data.value.security_id)];
    case 'OcfRecordDataWarrantCancellation':
      return [
        securityRef('Warrant cancellation', 'TX_WARRANT_ISSUANCE', data.value.security_id),
        ...optionalList(data.value.balance_security_id).map((id) =>
          securityRef('Warrant cancellation balance', 'TX_WARRANT_ISSUANCE', id)
        ),
      ];
    case 'OcfRecordDataWarrantExercise':
      return [
        securityRef('Warrant exercise', 'TX_WARRANT_ISSUANCE', data.value.security_id),
        {
          kind: 'trigger',
          label: 'Warrant exercise',
          security_id: data.value.security_id,
          trigger_id: data.value.trigger_id,
        },
        ...data.value.resulting_security_ids.map((id) =>
          securityRef('Warrant exercise resulting security', 'TX_STOCK_ISSUANCE', id)
        ),
      ];
    case 'OcfRecordDataWarrantIssuance':
      return [
        stakeholderRef('Warrant issuance stakeholder', data.value.stakeholder_id),
        ...optionalList(data.value.vesting_terms_id).map((id) => vestingTermsRef('Warrant vesting terms', id)),
        ...data.value.exercise_triggers.flatMap((trigger) =>
          conversionRightTargets('Warrant exercise trigger', trigger.conversion_right)
        ),
      ];
    case 'OcfRecordDataWarrantRetraction':
      return [securityRef('Warrant retraction', 'TX_WARRANT_ISSUANCE', data.value.security_id)];
    case 'OcfRecordDataWarrantTransfer':
      return [
        securityRef('Warrant transfer', 'TX_WARRANT_ISSUANCE', data.value.security_id),
        ...data.value.resulting_security_ids.map((id) =>
          securityRef('Warrant transfer resulting security', 'TX_WARRANT_ISSUANCE', id)
        ),
        ...optionalList(data.value.balance_security_id).map((id) =>
          securityRef('Warrant transfer balance', 'TX_WARRANT_ISSUANCE', id)
        ),
      ];
    // Stock events on a state, definitions with no references and the hold pair.
    case 'OcfRecordDataStockAcceptance':
    case 'OcfRecordDataStockCancellation':
    case 'OcfRecordDataStockConsolidation':
    case 'OcfRecordDataStockConversion':
    case 'OcfRecordDataStockHold':
    case 'OcfRecordDataStockHoldCancellation':
    case 'OcfRecordDataStockLegendTemplate':
    case 'OcfRecordDataStockReissuance':
    case 'OcfRecordDataStockRepurchase':
    case 'OcfRecordDataStockRetraction':
    case 'OcfRecordDataStockTransfer':
    case 'OcfRecordDataVestingAcceleration':
    case 'OcfRecordDataVestingTerms':
      return [];
  }
}

const SINGLE_SOURCE_EVENT_TAGS = [
  'OcfRecordDataStockTransfer',
  'OcfRecordDataStockCancellation',
  'OcfRecordDataStockRepurchase',
  'OcfRecordDataStockRetraction',
  'OcfRecordDataStockConversion',
  'OcfRecordDataStockReissuance',
] as const;

/** The securities a stock record consumed (ended) (`Restate.consumedSecurities`). */
export function consumedSecurities(data: RecordData): string[] {
  if (data.tag === 'OcfRecordDataStockConsolidation') return [...data.value.security_ids];
  return hasTag(data, SINGLE_SOURCE_EVENT_TAGS) ? [data.value.security_id] : [];
}

/** The entity kinds whose records consume a stock security. */
export const CONSUMING_ENTITY_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockTransfer',
  'stockCancellation',
  'stockRepurchase',
  'stockRetraction',
  'stockConversion',
  'stockReissuance',
  'stockConsolidation',
]);

const VESTING_RECORD_TAGS = [
  'OcfRecordDataVestingStart',
  'OcfRecordDataVestingEvent',
  'OcfRecordDataVestingAcceleration',
] as const;

const SUBJECT_TAGS = [...VESTING_RECORD_TAGS, 'OcfRecordDataStockAcceptance'] as const;

/** The security a vesting record or a stock acceptance is on (`Restate.subjectSecurity`). */
export function subjectSecurity(data: RecordData): string | null {
  return hasTag(data, SUBJECT_TAGS) ? data.value.security_id : null;
}

/** Whether a record is a vesting start, event or acceleration (`Restate.isVestingRecord`). */
export function isVestingRecord(data: RecordData): boolean {
  return hasTag(data, VESTING_RECORD_TAGS);
}

/** How a requirement sees the write's working set (`References.Lookups`). */
export interface RequirementLookups {
  record(objectId: string): RecordData | null;
  security(securityId: string): RecordData | null;
  epochSplits(stockClassId: string): readonly RecordedSplit[] | null;
}

/** The vesting terms an issuance names: `null` for none, `undefined` for a record that cannot vest. */
export function vestingTermsIdOf(data: RecordData): string | null | undefined {
  return hasTag(data, VESTING_ISSUANCE_TAGS) ? data.value.vesting_terms_id : undefined;
}

/**
 * Checks one requirement against the working set (`checkRequirement`): `null` when it holds, else the ledger's
 * refusal.
 */
export function checkRequirement(lookups: RequirementLookups, requirement: RegisterRequirement): string | null {
  const { label } = requirement;
  switch (requirement.kind) {
    case 'object': {
      const found = lookups.record(requirement.object_id);
      if (found === null) return `${label} not found: ${requirement.object_id}`;
      const objectType = recordObjectType(found);
      return requirement.object_types.includes(objectType)
        ? null
        : `${label} ${requirement.object_id} is a ${showObjectType(objectType)}, not one of ${showObjectTypes(requirement.object_types)}`;
    }
    case 'security': {
      const found = lookups.security(requirement.security_id);
      if (found === null) return `${label} security not found: ${requirement.security_id}`;
      const objectType = recordObjectType(found);
      return requirement.object_types.includes(objectType)
        ? null
        : `${label} security ${requirement.security_id} is carried by a ${showObjectType(objectType)}`;
    }
    case 'plan_includes_class': {
      const plan = lookups.record(requirement.stock_plan_id);
      if (plan?.tag !== 'OcfRecordDataStockPlan') return `${label} not found: ${requirement.stock_plan_id}`;
      return plan.value.stock_class_ids.includes(requirement.stock_class_id)
        ? null
        : `${label} ${requirement.stock_plan_id} does not include stock class ${requirement.stock_class_id}`;
    }
    case 'ratio_conversion_right': {
      const stockClass = lookups.record(requirement.stock_class_id);
      if (stockClass?.tag !== 'OcfRecordDataStockClass') {
        return `${label} target not found: ${requirement.stock_class_id}`;
      }
      return stockClass.value.conversion_rights.length > 0
        ? null
        : `${label} targets a stock class without a ratio conversion right: ${requirement.stock_class_id}`;
    }
    case 'vesting_condition': {
      const { security_id: securityId, vesting_condition_id: conditionId } = requirement;
      const issuance = lookups.security(securityId);
      if (issuance === null) return `${label}: security not found: ${securityId}`;
      const termsId = vestingTermsIdOf(issuance);
      if (termsId === undefined) return `${label}: security ${securityId} cannot vest`;
      if (termsId === null) return `${label}: security ${securityId} has no vesting terms`;
      const terms = lookups.record(termsId);
      if (terms?.tag !== 'OcfRecordDataVestingTerms') return `${label}: vesting terms not found: ${termsId}`;
      const [condition] = terms.value.vesting_conditions.filter((candidate) => candidate.id === conditionId);
      if (condition === undefined) {
        return `${label} references missing vesting condition ${conditionId} for security ${securityId}`;
      }
      const matches = requirement.start
        ? condition.trigger.tag === 'OcfVestingStartTrigger'
        : condition.trigger.tag === 'OcfVestingEventTrigger';
      return matches ? null : `${label} references vesting condition ${conditionId} with the wrong trigger type`;
    }
    case 'trigger': {
      const issuance = lookups.security(requirement.security_id);
      if (issuance?.tag === 'OcfRecordDataWarrantIssuance') {
        return issuance.value.exercise_triggers.some((trigger) => trigger.trigger_id === requirement.trigger_id)
          ? null
          : `${label} trigger not found: ${requirement.trigger_id}`;
      }
      if (issuance?.tag === 'OcfRecordDataConvertibleIssuance') {
        return issuance.value.conversion_triggers.some((trigger) => trigger.trigger_id === requirement.trigger_id)
          ? null
          : `${label} trigger not found: ${requirement.trigger_id}`;
      }
      return `${label} security not found: ${requirement.security_id}`;
    }
    case 'split_of_class': {
      const { split_id: splitId, stock_class_id: stockClassId } = requirement;
      const split = lookups.record(splitId);
      if (split?.tag !== 'OcfRecordDataStockClassSplit') return `${label} split transaction not found: ${splitId}`;
      if (split.value.stock_class_id !== stockClassId) {
        return `${label} split ${splitId} is of stock class ${split.value.stock_class_id}, not ${stockClassId}`;
      }
      if (split.value.date > requirement.on_or_before) return `${label} split ${splitId} is dated after the reissuance`;
      const recorded = lookups.epochSplits(stockClassId);
      return recorded?.some((candidate) => candidate.split_id === splitId) === true
        ? null
        : `${label} split ${splitId} is not recorded on its class's epoch`;
    }
  }
}
