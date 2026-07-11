import { getOcfObjectTypeCapability } from './ocfObjectTypeCapabilities';

/** The schema-valid identity fields required by graph validation. */
export type OcfCapTableSnapshotObject<ObjectType extends string = string> = Readonly<{
  id: string;
  object_type: ObjectType;
  [field: string]: unknown;
}>;

/** Canonical security families tracked by snapshot lineage validation. */
export type OcfSecurityFamily = 'convertible' | 'equity-compensation' | 'stock' | 'warrant';
/** Readonly evidence collection known to contain at least one value. */
export type OcfNonEmptyReadonlyArray<Value> = readonly [Value, ...Value[]];

type OcfIssue<Code extends string, Evidence extends object = object> = Readonly<
  { code: Code; message: string } & Evidence
>;
type LocatedIssueEvidence = Readonly<{ objectType: string; objectId: string; path: string }>;
type ReferenceIssueEvidence = LocatedIssueEvidence &
  Readonly<{ referenceId: string; targetObjectTypes: OcfNonEmptyReadonlyArray<string> }>;
type SecurityReferenceIssueEvidence = LocatedIssueEvidence &
  Readonly<{
    referenceId: string;
    expectedSecurityFamilies: OcfNonEmptyReadonlyArray<OcfSecurityFamily>;
  }>;

/** A deterministic diagnostic whose evidence is correlated to its issue code. */
export type OcfCapTableSnapshotIssue =
  | OcfIssue<
      'AMBIGUOUS_SECURITY_REFERENCE',
      SecurityReferenceIssueEvidence &
        Readonly<{ producerObjectTypes: OcfNonEmptyReadonlyArray<string>; count: number }>
    >
  | OcfIssue<'AMBIGUOUS_TRIGGER', ReferenceIssueEvidence & Readonly<{ count: number }>>
  | OcfIssue<
      'AMBIGUOUS_VESTING_TERMS',
      LocatedIssueEvidence &
        Readonly<{
          securityId: string;
          targetObjectTypes: OcfNonEmptyReadonlyArray<string>;
          /** The two lexicographically smallest IDs that prove the ambiguity. */
          witnessVestingTermsIds: readonly [string, string];
        }>
    >
  | OcfIssue<'DUPLICATE_OBJECT_ID', Readonly<{ objectType: string; objectId: string; count: number }>>
  | OcfIssue<
      'DUPLICATE_SECURITY_PRODUCER',
      LocatedIssueEvidence &
        Readonly<{
          referenceId: string;
          producerObjectTypes: OcfNonEmptyReadonlyArray<string>;
          count: number;
        }>
    >
  | OcfIssue<
      'DUPLICATE_TRIGGER_ID' | 'DUPLICATE_VESTING_CONDITION_ID',
      LocatedIssueEvidence & Readonly<{ referenceId: string; count: number }>
    >
  | OcfIssue<'ISSUER_CARDINALITY', Readonly<{ objectType: 'ISSUER'; count: number }>>
  | OcfIssue<'MALFORMED_SECURITY_FIELD', LocatedIssueEvidence>
  | OcfIssue<'MISSING_REFERENCE', ReferenceIssueEvidence>
  | OcfIssue<'MISSING_SECURITY_REFERENCE', SecurityReferenceIssueEvidence>
  | OcfIssue<
      'MISSING_VESTING_TERMS',
      LocatedIssueEvidence & Readonly<{ securityId: string; targetObjectTypes: OcfNonEmptyReadonlyArray<string> }>
    >
  | OcfIssue<'MISSING_TRIGGER' | 'MISSING_VESTING_CONDITION', ReferenceIssueEvidence>
  | OcfIssue<
      'MULTIPLE_SECURITY_CONSUMERS',
      LocatedIssueEvidence &
        Readonly<{
          referenceId: string;
          consumerObjectTypes: OcfNonEmptyReadonlyArray<string>;
          count: number;
        }>
    >
  | OcfIssue<'SCHEMA_ONLY_REFERENCE', ReferenceIssueEvidence>
  | OcfIssue<
      'SECURITY_FAMILY_MISMATCH',
      SecurityReferenceIssueEvidence & Readonly<{ actualSecurityFamily: OcfSecurityFamily }>
    >
  | OcfIssue<
      'SECURITY_LINEAGE_CYCLE' | 'VESTING_CONDITION_CYCLE',
      LocatedIssueEvidence & Readonly<{ referenceId: string; cycleIds: OcfNonEmptyReadonlyArray<string> }>
    >
  | OcfIssue<'SELF_VESTING_CONDITION_REFERENCE', LocatedIssueEvidence & Readonly<{ referenceId: string }>>
  | OcfIssue<
      'STOCK_PLAN_CLASS_MISMATCH',
      LocatedIssueEvidence & Readonly<{ stockPlanId: string; stockClassId: string }>
    >
  | OcfIssue<
      'STOCK_PLAN_SECURITY_MISMATCH',
      LocatedIssueEvidence & Readonly<{ stockPlanId: string; securityId: string }>
    >
  | OcfIssue<'VESTING_TRIGGER_MISMATCH', ReferenceIssueEvidence>
  | OcfIssue<'UNSUPPORTED_OBJECT_TYPE', Readonly<{ objectType: string; objectId: string }>>;

/** Stable union of every structured snapshot issue code. */
export type OcfCapTableSnapshotIssueCode = OcfCapTableSnapshotIssue['code'];

/** Pure validation result with impossible validity/issue combinations excluded. */
export type OcfCapTableSnapshotValidationResult =
  | Readonly<{ valid: true; issues: readonly [] }>
  | Readonly<{
      valid: false;
      issues: readonly [OcfCapTableSnapshotIssue, ...OcfCapTableSnapshotIssue[]];
    }>;

type SecurityFamily = OcfSecurityFamily;

interface IndexedObject {
  canonicalObjectType: string;
  data: OcfCapTableSnapshotObject;
}

interface ObjectReferenceRule {
  sourceObjectTypes: readonly string[];
  path: string;
  targetObjectTypes: OcfNonEmptyReadonlyArray<string>;
  many?: boolean;
  optional?: boolean;
}

interface ObservedSecurityReferenceRule {
  sourceObjectTypes: readonly string[];
  path: 'security_id';
  targetFamilies: OcfNonEmptyReadonlyArray<SecurityFamily>;
}

type SecurityInputField = 'security_id' | 'security_ids';
type SecurityOutputField = 'balance_security_id' | 'resulting_security_id' | 'resulting_security_ids';

interface SecurityInputRule {
  path: SecurityInputField;
  cardinality: 'one' | 'many';
  families: OcfNonEmptyReadonlyArray<SecurityFamily>;
  minimumItems?: 0 | 1;
}

interface SecurityOutputRule {
  path: SecurityOutputField;
  cardinality: 'one' | 'many';
  family: SecurityFamily;
  optional?: boolean;
  minimumItems?: 0 | 1;
}

interface SecurityTransitionRule {
  input: SecurityInputRule;
  outputs: readonly SecurityOutputRule[];
}

interface SecurityFieldValue {
  id: string;
  path: string;
}

interface SecurityTransitionInstance {
  source: IndexedObject;
  rule: SecurityTransitionRule;
  inputs: readonly SecurityFieldValue[];
  inputFieldValid: boolean;
  outputs: ReadonlyArray<SecurityFieldValue & { family: SecurityFamily }>;
}

interface SecurityProducer {
  id: string;
  family: SecurityFamily;
  source: IndexedObject;
  path: string;
  kind: 'issuance' | 'transition';
  inputIds: readonly string[];
}

interface SecurityRootFacts {
  hasRoot: boolean;
  uniqueRoot: SecurityProducer | undefined;
  hasMultipleRoots: boolean;
  hasNonPlanRoot: boolean;
  hasMissingVestingTerms: boolean;
  vestingTermsIds: readonly string[];
}

interface DirectedGraphEdge {
  from: string;
  to: string;
  source: IndexedObject;
  path: string;
}

const ISSUANCE_OBJECT_TYPE_BY_FAMILY = {
  convertible: 'TX_CONVERTIBLE_ISSUANCE',
  'equity-compensation': 'TX_EQUITY_COMPENSATION_ISSUANCE',
  stock: 'TX_STOCK_ISSUANCE',
  warrant: 'TX_WARRANT_ISSUANCE',
} as const satisfies Record<SecurityFamily, string>;

const ISSUANCE_OBJECT_TYPES = Object.values(ISSUANCE_OBJECT_TYPE_BY_FAMILY);

const OBJECT_REFERENCE_RULES: readonly ObjectReferenceRule[] = [
  {
    sourceObjectTypes: ['TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT'],
    path: 'issuer_id',
    targetObjectTypes: ['ISSUER'],
  },
  {
    sourceObjectTypes: ['CE_STAKEHOLDER_RELATIONSHIP', 'CE_STAKEHOLDER_STATUS'],
    path: 'stakeholder_id',
    targetObjectTypes: ['STAKEHOLDER'],
  },
  {
    sourceObjectTypes: ISSUANCE_OBJECT_TYPES,
    path: 'stakeholder_id',
    targetObjectTypes: ['STAKEHOLDER'],
  },
  {
    sourceObjectTypes: [
      'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
      'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
      'TX_STOCK_CLASS_SPLIT',
      'TX_STOCK_ISSUANCE',
      'VALUATION',
    ],
    path: 'stock_class_id',
    targetObjectTypes: ['STOCK_CLASS'],
  },
  {
    sourceObjectTypes: ['TX_EQUITY_COMPENSATION_ISSUANCE'],
    path: 'stock_class_id',
    targetObjectTypes: ['STOCK_CLASS'],
    optional: true,
  },
  {
    sourceObjectTypes: ['STOCK_PLAN'],
    path: 'stock_class_id',
    targetObjectTypes: ['STOCK_CLASS'],
    optional: true,
  },
  {
    sourceObjectTypes: ['STOCK_PLAN'],
    path: 'stock_class_ids',
    targetObjectTypes: ['STOCK_CLASS'],
    many: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_PLAN_POOL_ADJUSTMENT', 'TX_STOCK_PLAN_RETURN_TO_POOL'],
    path: 'stock_plan_id',
    targetObjectTypes: ['STOCK_PLAN'],
  },
  {
    sourceObjectTypes: ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE'],
    path: 'stock_plan_id',
    targetObjectTypes: ['STOCK_PLAN'],
    optional: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'TX_WARRANT_ISSUANCE'],
    path: 'vesting_terms_id',
    targetObjectTypes: ['VESTING_TERMS'],
    optional: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_ISSUANCE'],
    path: 'stock_legend_ids',
    targetObjectTypes: ['STOCK_LEGEND_TEMPLATE'],
    many: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_REISSUANCE'],
    path: 'split_transaction_id',
    targetObjectTypes: ['TX_STOCK_CLASS_SPLIT'],
    optional: true,
  },
];

/** Security references that observe a security without terminating its lineage. */
const OBSERVED_SECURITY_REFERENCE_RULES: readonly ObservedSecurityReferenceRule[] = [
  {
    sourceObjectTypes: ['TX_CONVERTIBLE_ACCEPTANCE'],
    path: 'security_id',
    targetFamilies: ['convertible'],
  },
  {
    sourceObjectTypes: ['TX_EQUITY_COMPENSATION_ACCEPTANCE', 'TX_EQUITY_COMPENSATION_REPRICING'],
    path: 'security_id',
    targetFamilies: ['equity-compensation'],
  },
  {
    sourceObjectTypes: ['TX_STOCK_ACCEPTANCE'],
    path: 'security_id',
    targetFamilies: ['stock'],
  },
  {
    // OCF samples pair a cancellation and return-to-pool for the same security.
    // Treat the return as cancellation accounting, not a second lineage consumer.
    sourceObjectTypes: ['TX_STOCK_PLAN_RETURN_TO_POOL'],
    path: 'security_id',
    targetFamilies: ['stock', 'equity-compensation'],
  },
  {
    sourceObjectTypes: ['TX_WARRANT_ACCEPTANCE'],
    path: 'security_id',
    targetFamilies: ['warrant'],
  },
  {
    sourceObjectTypes: ['TX_VESTING_ACCELERATION', 'TX_VESTING_EVENT', 'TX_VESTING_START'],
    path: 'security_id',
    targetFamilies: ['stock', 'warrant', 'equity-compensation'],
  },
];

type SecurityTransitionObjectType =
  | 'TX_CONVERTIBLE_CANCELLATION'
  | 'TX_CONVERTIBLE_CONVERSION'
  | 'TX_CONVERTIBLE_RETRACTION'
  | 'TX_CONVERTIBLE_TRANSFER'
  | 'TX_EQUITY_COMPENSATION_CANCELLATION'
  | 'TX_EQUITY_COMPENSATION_EXERCISE'
  | 'TX_EQUITY_COMPENSATION_RELEASE'
  | 'TX_EQUITY_COMPENSATION_RETRACTION'
  | 'TX_EQUITY_COMPENSATION_TRANSFER'
  | 'TX_STOCK_CANCELLATION'
  | 'TX_STOCK_CONSOLIDATION'
  | 'TX_STOCK_CONVERSION'
  | 'TX_STOCK_REISSUANCE'
  | 'TX_STOCK_REPURCHASE'
  | 'TX_STOCK_RETRACTION'
  | 'TX_STOCK_TRANSFER'
  | 'TX_WARRANT_CANCELLATION'
  | 'TX_WARRANT_EXERCISE'
  | 'TX_WARRANT_RETRACTION'
  | 'TX_WARRANT_TRANSFER';

const oneInput = (family: SecurityFamily): SecurityInputRule => ({
  path: 'security_id',
  cardinality: 'one',
  families: [family],
});

const manyStockInputs: SecurityInputRule = {
  path: 'security_ids',
  cardinality: 'many',
  families: ['stock'],
  minimumItems: 1,
};

const optionalBalance = (family: SecurityFamily): SecurityOutputRule => ({
  path: 'balance_security_id',
  cardinality: 'one',
  family,
  optional: true,
});

const resultingMany = (family: SecurityFamily, minimumItems: 0 | 1): SecurityOutputRule => ({
  path: 'resulting_security_ids',
  cardinality: 'many',
  family,
  minimumItems,
});

/**
 * Complete security-consuming transition matrix.
 *
 * Inputs consume existing lineage nodes. Output fields produce new nodes; they
 * deliberately do not resolve against issuance objects in the same snapshot.
 * ReturnToPool is intentionally excluded because canonical OCF samples pair it
 * with a cancellation for the same security; it records where cancelled plan
 * securities return without consuming the lineage a second time.
 */
const SECURITY_TRANSITION_RULES = {
  TX_CONVERTIBLE_CANCELLATION: {
    input: oneInput('convertible'),
    outputs: [optionalBalance('convertible')],
  },
  TX_CONVERTIBLE_CONVERSION: {
    input: oneInput('convertible'),
    outputs: [optionalBalance('convertible'), resultingMany('stock', 0)],
  },
  TX_CONVERTIBLE_RETRACTION: { input: oneInput('convertible'), outputs: [] },
  TX_CONVERTIBLE_TRANSFER: {
    input: oneInput('convertible'),
    outputs: [optionalBalance('convertible'), resultingMany('convertible', 1)],
  },
  TX_EQUITY_COMPENSATION_CANCELLATION: {
    input: oneInput('equity-compensation'),
    outputs: [optionalBalance('equity-compensation')],
  },
  TX_EQUITY_COMPENSATION_EXERCISE: {
    input: oneInput('equity-compensation'),
    outputs: [resultingMany('stock', 0)],
  },
  TX_EQUITY_COMPENSATION_RELEASE: {
    input: oneInput('equity-compensation'),
    outputs: [resultingMany('stock', 0)],
  },
  TX_EQUITY_COMPENSATION_RETRACTION: { input: oneInput('equity-compensation'), outputs: [] },
  TX_EQUITY_COMPENSATION_TRANSFER: {
    input: oneInput('equity-compensation'),
    outputs: [optionalBalance('equity-compensation'), resultingMany('equity-compensation', 1)],
  },
  TX_STOCK_CANCELLATION: { input: oneInput('stock'), outputs: [optionalBalance('stock')] },
  TX_STOCK_CONSOLIDATION: {
    input: manyStockInputs,
    outputs: [{ path: 'resulting_security_id', cardinality: 'one', family: 'stock' }],
  },
  TX_STOCK_CONVERSION: {
    input: oneInput('stock'),
    outputs: [optionalBalance('stock'), resultingMany('stock', 0)],
  },
  TX_STOCK_REISSUANCE: { input: oneInput('stock'), outputs: [resultingMany('stock', 0)] },
  TX_STOCK_REPURCHASE: { input: oneInput('stock'), outputs: [optionalBalance('stock')] },
  TX_STOCK_RETRACTION: { input: oneInput('stock'), outputs: [] },
  TX_STOCK_TRANSFER: {
    input: oneInput('stock'),
    outputs: [optionalBalance('stock'), resultingMany('stock', 1)],
  },
  TX_WARRANT_CANCELLATION: { input: oneInput('warrant'), outputs: [optionalBalance('warrant')] },
  TX_WARRANT_EXERCISE: { input: oneInput('warrant'), outputs: [resultingMany('stock', 0)] },
  TX_WARRANT_RETRACTION: { input: oneInput('warrant'), outputs: [] },
  TX_WARRANT_TRANSFER: {
    input: oneInput('warrant'),
    outputs: [optionalBalance('warrant'), resultingMany('warrant', 1)],
  },
} as const satisfies Readonly<Record<SecurityTransitionObjectType, SecurityTransitionRule>>;

const CONVERSION_RIGHT_ROOTS: Readonly<Partial<Record<string, readonly string[]>>> = {
  STOCK_CLASS: ['conversion_rights'],
  TX_CONVERTIBLE_ISSUANCE: ['conversion_triggers'],
  TX_WARRANT_ISSUANCE: ['exercise_triggers'],
};

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function stringValues(value: unknown, many: boolean, optional: boolean): string[] {
  if (many) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && (!optional || item.length > 0))
      : [];
  }
  return typeof value === 'string' && (!optional || value.length > 0) ? [value] : [];
}

function canonicalObjectType(objectType: string): string {
  const capability = getOcfObjectTypeCapability(objectType);
  return capability.support === 'ledger-backed' ? capability.canonicalObjectType : objectType;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireFirst<T>(values: readonly T[], context: string): T {
  const first = values[0];
  if (first === undefined) throw new Error(`Internal snapshot validator invariant failed: ${context}`);
  return first;
}

function toNonEmptyArray<Value>(values: readonly Value[], context: string): OcfNonEmptyReadonlyArray<Value> {
  const first = requireFirst(values, context);
  return [first, ...values.slice(1)];
}

function indexObjects(objects: readonly OcfCapTableSnapshotObject[]): IndexedObject[] {
  return objects
    .map((data) => ({ data, canonicalObjectType: canonicalObjectType(data.object_type) }))
    .sort((left, right) => {
      const typeOrder = compareText(left.canonicalObjectType, right.canonicalObjectType);
      return typeOrder !== 0 ? typeOrder : compareText(left.data.id, right.data.id);
    });
}

function issueSortKey(issue: OcfCapTableSnapshotIssue): string {
  return [
    issue.code,
    'objectType' in issue ? issue.objectType : '',
    'objectId' in issue ? issue.objectId : '',
    'path' in issue ? issue.path : '',
    'referenceId' in issue ? issue.referenceId : '',
    'securityId' in issue ? issue.securityId : '',
    'witnessVestingTermsIds' in issue ? issue.witnessVestingTermsIds.join(',') : '',
    'targetObjectTypes' in issue ? issue.targetObjectTypes.join(',') : '',
    'producerObjectTypes' in issue ? issue.producerObjectTypes.join(',') : '',
    'consumerObjectTypes' in issue ? issue.consumerObjectTypes.join(',') : '',
    'expectedSecurityFamilies' in issue ? issue.expectedSecurityFamilies.join(',') : '',
    'actualSecurityFamily' in issue ? issue.actualSecurityFamily : '',
    'stockPlanId' in issue ? issue.stockPlanId : '',
    'stockClassId' in issue ? issue.stockClassId : '',
    'cycleIds' in issue ? issue.cycleIds.join(',') : '',
    String('count' in issue ? issue.count : ''),
  ].join('\u0000');
}

function freezeIssue<Issue extends OcfCapTableSnapshotIssue>(issue: Issue): Issue {
  const frozenIssue = {
    ...issue,
    ...('targetObjectTypes' in issue ? { targetObjectTypes: Object.freeze([...issue.targetObjectTypes]) } : {}),
    ...('producerObjectTypes' in issue ? { producerObjectTypes: Object.freeze([...issue.producerObjectTypes]) } : {}),
    ...('consumerObjectTypes' in issue ? { consumerObjectTypes: Object.freeze([...issue.consumerObjectTypes]) } : {}),
    ...('expectedSecurityFamilies' in issue
      ? { expectedSecurityFamilies: Object.freeze([...issue.expectedSecurityFamilies]) }
      : {}),
    ...('cycleIds' in issue ? { cycleIds: Object.freeze([...issue.cycleIds]) } : {}),
    ...('witnessVestingTermsIds' in issue
      ? { witnessVestingTermsIds: Object.freeze([...issue.witnessVestingTermsIds]) }
      : {}),
  };
  return Object.freeze(frozenIssue) as Issue;
}

function objectKey(objectType: string, objectId: string): string {
  return `${objectType}\u0000${objectId}`;
}

function targetLabel(targetObjectTypes: OcfNonEmptyReadonlyArray<string>): string {
  return targetObjectTypes.join(' or ');
}

function missingReferenceIssue(
  source: IndexedObject,
  path: string,
  referenceId: string,
  targetObjectTypes: OcfNonEmptyReadonlyArray<string>
): OcfCapTableSnapshotIssue {
  return {
    code: 'MISSING_REFERENCE',
    message: `${source.canonicalObjectType} ${source.data.id} ${path} references missing ${targetLabel(targetObjectTypes)} ${referenceId}`,
    objectType: source.canonicalObjectType,
    objectId: source.data.id,
    path,
    referenceId,
    targetObjectTypes,
  };
}

function issuanceFamily(objectType: string): SecurityFamily | undefined {
  switch (objectType) {
    case 'TX_CONVERTIBLE_ISSUANCE':
      return 'convertible';
    case 'TX_EQUITY_COMPENSATION_ISSUANCE':
      return 'equity-compensation';
    case 'TX_STOCK_ISSUANCE':
      return 'stock';
    case 'TX_WARRANT_ISSUANCE':
      return 'warrant';
    default:
      return undefined;
  }
}

function securityTransitionRule(objectType: string): SecurityTransitionRule | undefined {
  if (!Object.prototype.hasOwnProperty.call(SECURITY_TRANSITION_RULES, objectType)) return undefined;
  return SECURITY_TRANSITION_RULES[objectType as SecurityTransitionObjectType];
}

function malformedSecurityFieldIssue(source: IndexedObject, path: string, message: string): OcfCapTableSnapshotIssue {
  return {
    code: 'MALFORMED_SECURITY_FIELD',
    message: `${source.canonicalObjectType} ${source.data.id} ${path} ${message}`,
    objectType: source.canonicalObjectType,
    objectId: source.data.id,
    path,
  };
}

function readSecurityField(
  source: IndexedObject,
  path: SecurityInputField | SecurityOutputField,
  cardinality: 'one' | 'many',
  optional: boolean,
  minimumItems: 0 | 1,
  issues: OcfCapTableSnapshotIssue[]
): SecurityFieldValue[] {
  const value = source.data[path];
  if (optional && (value === undefined || value === '')) return [];

  if (cardinality === 'one') {
    if (typeof value !== 'string' || value.length === 0) {
      issues.push(
        malformedSecurityFieldIssue(
          source,
          path,
          optional ? 'must be a non-empty string when present' : 'must be a non-empty string'
        )
      );
      return [];
    }
    return [{ id: value, path }];
  }

  if (!Array.isArray(value)) {
    issues.push(malformedSecurityFieldIssue(source, path, 'must be an array of non-empty strings'));
    return [];
  }
  if (minimumItems === 1 && value.length === 0) {
    issues.push(malformedSecurityFieldIssue(source, path, 'must contain at least one non-empty string'));
    return [];
  }

  const values: SecurityFieldValue[] = [];
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (typeof item !== 'string' || item.length === 0) {
      issues.push(malformedSecurityFieldIssue(source, itemPath, 'must be a non-empty string'));
      return;
    }
    values.push({ id: item, path: itemPath });
  });
  return values;
}

function directedCycles(nodes: Iterable<string>, edges: readonly DirectedGraphEdge[]): string[][] {
  const adjacency = new Map<string, Set<string>>();
  const reverseAdjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node, new Set());
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from) ?? new Set<string>();
    neighbors.add(edge.to);
    adjacency.set(edge.from, neighbors);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    const reverseNeighbors = reverseAdjacency.get(edge.to) ?? new Set<string>();
    reverseNeighbors.add(edge.from);
    reverseAdjacency.set(edge.to, reverseNeighbors);
    if (!reverseAdjacency.has(edge.from)) reverseAdjacency.set(edge.from, new Set());
  }
  for (const node of adjacency.keys()) {
    if (!reverseAdjacency.has(node)) reverseAdjacency.set(node, new Set());
  }

  const visited = new Set<string>();
  const finishOrder: string[] = [];
  for (const start of [...adjacency.keys()].sort(compareText)) {
    if (visited.has(start)) continue;
    const stack: Array<{ node: string; expanded: boolean }> = [{ node: start, expanded: false }];
    while (stack.length > 0) {
      const frame = stack.pop();
      if (frame === undefined) break;
      if (frame.expanded) {
        finishOrder.push(frame.node);
        continue;
      }
      if (visited.has(frame.node)) continue;
      visited.add(frame.node);
      stack.push({ node: frame.node, expanded: true });
      const neighbors = [...(adjacency.get(frame.node) ?? [])].sort(compareText).reverse();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) stack.push({ node: neighbor, expanded: false });
      }
    }
  }

  const assigned = new Set<string>();
  const components: string[][] = [];
  for (const start of [...finishOrder].reverse()) {
    if (assigned.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) break;
      component.push(node);
      const neighbors = [...(reverseAdjacency.get(node) ?? [])].sort(compareText).reverse();
      for (const neighbor of neighbors) {
        if (assigned.has(neighbor)) continue;
        assigned.add(neighbor);
        stack.push(neighbor);
      }
    }
    component.sort(compareText);
    const hasSelfEdge = component.length === 1 && (adjacency.get(component[0] ?? '')?.has(component[0] ?? '') ?? false);
    if (component.length > 1 || hasSelfEdge) components.push(component);
  }
  return components.sort((left, right) => compareText(left.join('\u0000'), right.join('\u0000')));
}

function edgeSortKey(edge: DirectedGraphEdge): string {
  return [edge.source.canonicalObjectType, edge.source.data.id, edge.path, edge.from, edge.to].join('\u0000');
}

function collectNestedStringField(
  value: unknown,
  field: string,
  path: string,
  result: Array<{ path: string; value: string }>
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNestedStringField(item, field, `${path}[${index}]`, result));
    return;
  }

  const record = asRecord(value);
  if (record === null) return;
  for (const key of Object.keys(record).sort()) {
    const nextPath = path.length === 0 ? key : `${path}.${key}`;
    if (key === field && typeof record[key] === 'string') {
      result.push({ path: nextPath, value: record[key] });
    } else {
      collectNestedStringField(record[key], field, nextPath, result);
    }
  }
}

function stockPlanClassIds(plan: OcfCapTableSnapshotObject): Set<string> {
  const ids = new Set<string>();
  if (typeof plan.stock_class_id === 'string') ids.add(plan.stock_class_id);
  if (Array.isArray(plan.stock_class_ids)) {
    for (const value of plan.stock_class_ids) {
      if (typeof value === 'string') ids.add(value);
    }
  }
  return ids;
}

function triggerIdCounts(issuance: OcfCapTableSnapshotObject, field: string): Map<string, number> {
  const triggers = issuance[field];
  const counts = new Map<string, number>();
  if (!Array.isArray(triggers)) return counts;
  for (const trigger of triggers) {
    const triggerId = asRecord(trigger)?.trigger_id;
    if (typeof triggerId !== 'string' || triggerId.length === 0) continue;
    counts.set(triggerId, (counts.get(triggerId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Validate final-state graph integrity for a complete, schema-valid OCF snapshot.
 *
 * The function is deliberately order-independent and side-effect free. It does
 * not validate transaction chronology, balances, or business quantities.
 */
export function validateOcfCapTableSnapshot(
  objects: readonly OcfCapTableSnapshotObject[]
): OcfCapTableSnapshotValidationResult {
  const indexed = indexObjects(objects);
  const issues: OcfCapTableSnapshotIssue[] = [];
  const objectsByKey = new Map<string, IndexedObject[]>();
  const securityProducers = new Map<string, SecurityProducer[]>();
  const terminalConsumers = new Map<string, Array<{ source: IndexedObject; path: string }>>();
  const transitionInstances: SecurityTransitionInstance[] = [];
  const outputProducersByTransition = new Map<SecurityTransitionInstance, SecurityProducer[]>();
  const validTransitions = new Set<SecurityTransitionInstance>();
  const validObservedSecurityProducers = new Map<IndexedObject, SecurityProducer>();
  const lineageEdges: DirectedGraphEdge[] = [];

  for (const item of indexed) {
    const key = objectKey(item.canonicalObjectType, item.data.id);
    const sameObjects = objectsByKey.get(key) ?? [];
    sameObjects.push(item);
    objectsByKey.set(key, sameObjects);

    const capability = getOcfObjectTypeCapability(item.data.object_type);
    if (capability.support === 'unsupported') {
      issues.push({
        code: 'UNSUPPORTED_OBJECT_TYPE',
        message: `Unsupported OCF object type ${item.data.object_type}`,
        objectType: item.data.object_type,
        objectId: item.data.id,
      });
    }

    const family = issuanceFamily(item.canonicalObjectType);
    if (family !== undefined) {
      const securityId = item.data.security_id;
      if (typeof securityId !== 'string' || securityId.length === 0) {
        issues.push(malformedSecurityFieldIssue(item, 'security_id', 'must be a non-empty string'));
      } else {
        const producers = securityProducers.get(securityId) ?? [];
        producers.push({
          id: securityId,
          family,
          source: item,
          path: 'security_id',
          kind: 'issuance',
          inputIds: [],
        });
        securityProducers.set(securityId, producers);
      }
    }
  }

  const issuerCount = indexed.filter((item) => item.canonicalObjectType === 'ISSUER').length;
  if (issuerCount !== 1) {
    issues.push({
      code: 'ISSUER_CARDINALITY',
      message: `Expected exactly one ISSUER, found ${issuerCount}`,
      objectType: 'ISSUER',
      count: issuerCount,
    });
  }

  for (const matches of objectsByKey.values()) {
    if (matches.length > 1) {
      const first = requireFirst(matches, 'duplicate object list must be non-empty');
      issues.push({
        code: 'DUPLICATE_OBJECT_ID',
        message: `Duplicate ${first.canonicalObjectType} id ${first.data.id}`,
        objectType: first.canonicalObjectType,
        objectId: first.data.id,
        count: matches.length,
      });
    }
  }

  for (const source of indexed) {
    const rule = securityTransitionRule(source.canonicalObjectType);
    if (rule === undefined) continue;
    const issueCountBeforeInput = issues.length;
    const inputs = readSecurityField(
      source,
      rule.input.path,
      rule.input.cardinality,
      false,
      rule.input.minimumItems ?? 0,
      issues
    );
    const inputFieldValid = issues.length === issueCountBeforeInput;
    const outputs = rule.outputs.flatMap((outputRule) =>
      readSecurityField(
        source,
        outputRule.path,
        outputRule.cardinality,
        outputRule.optional === true,
        outputRule.minimumItems ?? 0,
        issues
      ).map((output) => ({ ...output, family: outputRule.family }))
    );
    const instance: SecurityTransitionInstance = { source, rule, inputs, inputFieldValid, outputs };
    transitionInstances.push(instance);
    const outputProducers: SecurityProducer[] = [];
    for (const output of outputs) {
      const producers = securityProducers.get(output.id) ?? [];
      const producer: SecurityProducer = {
        id: output.id,
        family: output.family,
        source,
        path: output.path,
        kind: 'transition',
        inputIds: [],
      };
      producers.push(producer);
      outputProducers.push(producer);
      securityProducers.set(output.id, producers);
    }
    outputProducersByTransition.set(instance, outputProducers);
  }

  for (const [securityId, producers] of securityProducers) {
    if (producers.length > 1) {
      const sortedProducers = [...producers].sort((left, right) =>
        compareText(
          [left.source.canonicalObjectType, left.source.data.id, left.path].join('\u0000'),
          [right.source.canonicalObjectType, right.source.data.id, right.path].join('\u0000')
        )
      );
      const first = requireFirst(sortedProducers, 'duplicate producer list must be non-empty');
      issues.push({
        code: 'DUPLICATE_SECURITY_PRODUCER',
        message: `Security ${securityId} has ${producers.length} producers`,
        objectType: first.source.canonicalObjectType,
        objectId: first.source.data.id,
        path: first.path,
        referenceId: securityId,
        producerObjectTypes: toNonEmptyArray(
          [...new Set(producers.map((producer) => producer.source.canonicalObjectType))].sort(compareText),
          'duplicate producer object type list must be non-empty'
        ),
        count: producers.length,
      });
    }
  }

  const hasObject = (objectTypes: readonly string[], id: string): boolean =>
    objectTypes.some((objectType) => objectsByKey.has(objectKey(objectType, id)));

  for (const rule of OBJECT_REFERENCE_RULES) {
    for (const source of indexed.filter((item) => rule.sourceObjectTypes.includes(item.canonicalObjectType))) {
      for (const referenceId of stringValues(source.data[rule.path], rule.many === true, rule.optional === true)) {
        if (!hasObject(rule.targetObjectTypes, referenceId)) {
          issues.push(missingReferenceIssue(source, rule.path, referenceId, rule.targetObjectTypes));
        }
      }
    }
  }

  const validateSecurityReference = (
    source: IndexedObject,
    reference: SecurityFieldValue,
    targetFamilies: OcfNonEmptyReadonlyArray<SecurityFamily>
  ): SecurityProducer | undefined => {
    const producers = securityProducers.get(reference.id) ?? [];
    if (producers.length === 0) {
      issues.push({
        code: 'MISSING_SECURITY_REFERENCE',
        message: `${source.canonicalObjectType} ${source.data.id} ${reference.path} references missing ${targetFamilies.join(' or ')} security ${reference.id}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: reference.path,
        referenceId: reference.id,
        expectedSecurityFamilies: targetFamilies,
      });
      return undefined;
    }
    if (producers.length > 1) {
      issues.push({
        code: 'AMBIGUOUS_SECURITY_REFERENCE',
        message: `${source.canonicalObjectType} ${source.data.id} ${reference.path} ambiguously references security ${reference.id}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: reference.path,
        referenceId: reference.id,
        expectedSecurityFamilies: targetFamilies,
        producerObjectTypes: toNonEmptyArray(
          [...new Set(producers.map((producer) => producer.source.canonicalObjectType))].sort(compareText),
          'ambiguous producer object type list must be non-empty'
        ),
        count: producers.length,
      });
      return undefined;
    }
    const producer = requireFirst(producers, 'resolved security producer must be present');
    if (!targetFamilies.includes(producer.family)) {
      issues.push({
        code: 'SECURITY_FAMILY_MISMATCH',
        message: `${source.canonicalObjectType} ${source.data.id} ${reference.path} expects ${targetFamilies.join(' or ')}, but security ${reference.id} is ${producer.family}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: reference.path,
        referenceId: reference.id,
        expectedSecurityFamilies: targetFamilies,
        actualSecurityFamily: producer.family,
      });
      return undefined;
    }
    return producer;
  };

  for (const transition of transitionInstances) {
    const validInputs: SecurityFieldValue[] = [];
    for (const input of transition.inputs) {
      if (validateSecurityReference(transition.source, input, transition.rule.input.families) !== undefined) {
        validInputs.push(input);
      }
    }
    if (!transition.inputFieldValid || validInputs.length !== transition.inputs.length || validInputs.length === 0) {
      continue;
    }
    for (const producer of outputProducersByTransition.get(transition) ?? []) {
      producer.inputIds = validInputs.map((input) => input.id);
    }
    validTransitions.add(transition);
    for (const input of validInputs) {
      const consumers = terminalConsumers.get(input.id) ?? [];
      consumers.push({ source: transition.source, path: input.path });
      terminalConsumers.set(input.id, consumers);
      for (const output of transition.outputs) {
        lineageEdges.push({
          from: input.id,
          to: output.id,
          source: transition.source,
          path: output.path,
        });
      }
    }
  }

  for (const rule of OBSERVED_SECURITY_REFERENCE_RULES) {
    for (const source of indexed.filter((item) => rule.sourceObjectTypes.includes(item.canonicalObjectType))) {
      const references = readSecurityField(source, rule.path, 'one', false, 0, issues);
      for (const reference of references) {
        const producer = validateSecurityReference(source, reference, rule.targetFamilies);
        if (producer !== undefined) validObservedSecurityProducers.set(source, producer);
      }
    }
  }

  for (const [securityId, consumers] of terminalConsumers) {
    if (consumers.length <= 1) continue;
    const sortedConsumers = [...consumers].sort((left, right) =>
      compareText(
        [left.source.canonicalObjectType, left.source.data.id, left.path].join('\u0000'),
        [right.source.canonicalObjectType, right.source.data.id, right.path].join('\u0000')
      )
    );
    const first = requireFirst(sortedConsumers, 'multiple consumer list must be non-empty');
    issues.push({
      code: 'MULTIPLE_SECURITY_CONSUMERS',
      message: `Security ${securityId} is consumed by ${consumers.length} terminal transactions`,
      objectType: first.source.canonicalObjectType,
      objectId: first.source.data.id,
      path: first.path,
      referenceId: securityId,
      consumerObjectTypes: toNonEmptyArray(
        [...new Set(consumers.map((consumer) => consumer.source.canonicalObjectType))].sort(compareText),
        'multiple consumer object type list must be non-empty'
      ),
      count: consumers.length,
    });
  }

  const securityCycles = directedCycles(securityProducers.keys(), lineageEdges);
  const cyclicSecurityIds = new Set(securityCycles.flat());
  for (const cycleIds of securityCycles) {
    const firstCycleId = requireFirst(cycleIds, 'security cycle must contain a node');
    const cycleTuple: readonly [string, ...string[]] = [firstCycleId, ...cycleIds.slice(1)];
    const cycleSet = new Set(cycleIds);
    const cycleEdge = requireFirst(
      lineageEdges
        .filter((edge) => cycleSet.has(edge.from) && cycleSet.has(edge.to))
        .sort((left, right) => compareText(edgeSortKey(left), edgeSortKey(right))),
      'security cycle must contain an edge'
    );
    issues.push({
      code: 'SECURITY_LINEAGE_CYCLE',
      message: `Security lineage cycle includes ${cycleIds.join(', ')}`,
      objectType: cycleEdge.source.canonicalObjectType,
      objectId: cycleEdge.source.data.id,
      path: cycleEdge.path,
      referenceId: firstCycleId,
      cycleIds: cycleTuple,
    });
  }

  const noRootFacts: SecurityRootFacts = Object.freeze({
    hasRoot: false,
    uniqueRoot: undefined,
    hasMultipleRoots: false,
    hasNonPlanRoot: false,
    hasMissingVestingTerms: false,
    vestingTermsIds: Object.freeze([]),
  });
  const rootFactsCache = new Map<string, SecurityRootFacts>();
  const rootFactsForSecurity = (securityId: string): SecurityRootFacts => {
    const pending: Array<{ securityId: string; expanded: boolean }> = [{ securityId, expanded: false }];
    while (pending.length > 0) {
      const frame = pending.pop();
      if (frame === undefined || rootFactsCache.has(frame.securityId)) continue;
      if (cyclicSecurityIds.has(frame.securityId)) {
        rootFactsCache.set(frame.securityId, noRootFacts);
        continue;
      }
      const producers = securityProducers.get(frame.securityId) ?? [];
      if (producers.length !== 1) {
        rootFactsCache.set(frame.securityId, noRootFacts);
        continue;
      }
      const producer = requireFirst(producers, 'lineage producer must be present');
      if (producer.kind === 'issuance') {
        const planId = producer.source.data.stock_plan_id;
        const vestingTermsId = producer.source.data.vesting_terms_id;
        rootFactsCache.set(frame.securityId, {
          hasRoot: true,
          uniqueRoot: producer,
          hasMultipleRoots: false,
          hasNonPlanRoot: typeof planId !== 'string' || planId.length === 0,
          hasMissingVestingTerms: typeof vestingTermsId !== 'string' || vestingTermsId.length === 0,
          vestingTermsIds: typeof vestingTermsId === 'string' && vestingTermsId.length > 0 ? [vestingTermsId] : [],
        });
        continue;
      }
      if (!frame.expanded) {
        pending.push({ securityId: frame.securityId, expanded: true });
        for (const inputId of [...producer.inputIds].sort(compareText).reverse()) {
          if (!rootFactsCache.has(inputId)) pending.push({ securityId: inputId, expanded: false });
        }
        continue;
      }
      const inputFacts = producer.inputIds.map((inputId) => rootFactsCache.get(inputId) ?? noRootFacts);
      const uniqueRoots = new Map<string, SecurityProducer>();
      for (const facts of inputFacts) {
        if (facts.uniqueRoot === undefined) continue;
        uniqueRoots.set(
          objectKey(facts.uniqueRoot.source.canonicalObjectType, facts.uniqueRoot.source.data.id),
          facts.uniqueRoot
        );
      }
      const hasMultipleRoots = inputFacts.some((facts) => facts.hasMultipleRoots) || uniqueRoots.size > 1;
      const vestingTermsIds = [...new Set(inputFacts.flatMap((facts) => facts.vestingTermsIds))]
        .sort(compareText)
        .slice(0, 2);
      rootFactsCache.set(frame.securityId, {
        hasRoot: inputFacts.some((facts) => facts.hasRoot),
        uniqueRoot:
          !hasMultipleRoots && uniqueRoots.size === 1
            ? requireFirst([...uniqueRoots.values()], 'unique lineage root must be present')
            : undefined,
        hasMultipleRoots,
        hasNonPlanRoot: inputFacts.some((facts) => facts.hasNonPlanRoot),
        hasMissingVestingTerms: inputFacts.some((facts) => facts.hasMissingVestingTerms),
        vestingTermsIds,
      });
    }
    return rootFactsCache.get(securityId) ?? noRootFacts;
  };

  for (const terms of indexed.filter((item) => item.canonicalObjectType === 'VESTING_TERMS')) {
    if (!Array.isArray(terms.data.vesting_conditions)) continue;
    const conditionEntries = terms.data.vesting_conditions.flatMap((value, index) => {
      const condition = asRecord(value);
      return condition !== null && typeof condition.id === 'string' && condition.id.length > 0
        ? [{ condition, conditionId: condition.id, index }]
        : [];
    });
    const conditionsById = new Map<string, typeof conditionEntries>();
    for (const entry of conditionEntries) {
      const matches = conditionsById.get(entry.conditionId) ?? [];
      matches.push(entry);
      conditionsById.set(entry.conditionId, matches);
    }
    for (const [conditionId, matches] of conditionsById) {
      if (matches.length <= 1) continue;
      issues.push({
        code: 'DUPLICATE_VESTING_CONDITION_ID',
        message: `VESTING_TERMS ${terms.data.id} has duplicate vesting condition ${conditionId}`,
        objectType: 'VESTING_TERMS',
        objectId: terms.data.id,
        path: 'vesting_conditions',
        referenceId: conditionId,
        count: matches.length,
      });
    }

    const conditionEdges: DirectedGraphEdge[] = [];
    const addConditionReference = (
      from: string,
      to: string,
      path: string,
      edgeDirection: 'from-to' | 'to-from'
    ): void => {
      if (!conditionsById.has(to)) {
        issues.push({
          code: 'MISSING_VESTING_CONDITION',
          message: `VESTING_TERMS ${terms.data.id} ${path} references missing vesting condition ${to}`,
          objectType: 'VESTING_TERMS',
          objectId: terms.data.id,
          path,
          referenceId: to,
          targetObjectTypes: ['VESTING_TERMS'],
        });
        return;
      }
      if (from === to) {
        issues.push({
          code: 'SELF_VESTING_CONDITION_REFERENCE',
          message: `VESTING_TERMS ${terms.data.id} condition ${from} references itself`,
          objectType: 'VESTING_TERMS',
          objectId: terms.data.id,
          path,
          referenceId: from,
        });
        return;
      }
      conditionEdges.push(
        edgeDirection === 'from-to' ? { from, to, source: terms, path } : { from: to, to: from, source: terms, path }
      );
    };

    for (const entry of conditionEntries) {
      const nextConditionIds = entry.condition.next_condition_ids;
      if (Array.isArray(nextConditionIds)) {
        nextConditionIds.forEach((nextConditionId, nextIndex) => {
          if (typeof nextConditionId !== 'string' || nextConditionId.length === 0) return;
          addConditionReference(
            entry.conditionId,
            nextConditionId,
            `vesting_conditions[${entry.index}].next_condition_ids[${nextIndex}]`,
            'from-to'
          );
        });
      }
      const relativeToConditionId = asRecord(entry.condition.trigger)?.relative_to_condition_id;
      if (typeof relativeToConditionId === 'string' && relativeToConditionId.length > 0) {
        addConditionReference(
          entry.conditionId,
          relativeToConditionId,
          `vesting_conditions[${entry.index}].trigger.relative_to_condition_id`,
          'to-from'
        );
      }
    }

    for (const cycleIds of directedCycles(conditionsById.keys(), conditionEdges)) {
      const firstCycleId = requireFirst(cycleIds, 'vesting cycle must contain a node');
      const cycleTuple: readonly [string, ...string[]] = [firstCycleId, ...cycleIds.slice(1)];
      const cycleSet = new Set(cycleIds);
      const cycleEdge = requireFirst(
        conditionEdges
          .filter((edge) => cycleSet.has(edge.from) && cycleSet.has(edge.to))
          .sort((left, right) => compareText(edgeSortKey(left), edgeSortKey(right))),
        'vesting cycle must contain an edge'
      );
      issues.push({
        code: 'VESTING_CONDITION_CYCLE',
        message: `VESTING_TERMS ${terms.data.id} condition cycle includes ${cycleIds.join(', ')}`,
        objectType: 'VESTING_TERMS',
        objectId: terms.data.id,
        path: cycleEdge.path,
        referenceId: firstCycleId,
        cycleIds: cycleTuple,
      });
    }
  }

  for (const source of indexed) {
    const roots = CONVERSION_RIGHT_ROOTS[source.canonicalObjectType];
    if (roots === undefined) continue;
    for (const root of roots) {
      const references: Array<{ path: string; value: string }> = [];
      collectNestedStringField(source.data[root], 'converts_to_stock_class_id', root, references);
      for (const reference of references) {
        // Optional conversion targets use the OCF empty-string representation.
        // Required target presence remains the raw-schema validator's concern.
        if (reference.value.length > 0 && !hasObject(['STOCK_CLASS'], reference.value)) {
          issues.push(missingReferenceIssue(source, reference.path, reference.value, ['STOCK_CLASS']));
        }
      }
    }
  }

  for (const source of indexed.filter((item) =>
    ['TX_EQUITY_COMPENSATION_ISSUANCE', 'TX_STOCK_ISSUANCE'].includes(item.canonicalObjectType)
  )) {
    const planId = source.data.stock_plan_id;
    const classId = source.data.stock_class_id;
    if (typeof planId !== 'string' || planId.length === 0 || typeof classId !== 'string' || classId.length === 0) {
      continue;
    }
    const planMatches = objectsByKey.get(objectKey('STOCK_PLAN', planId)) ?? [];
    if (
      planMatches.length === 1 &&
      !stockPlanClassIds(requireFirst(planMatches, 'stock plan match must be present').data).has(classId)
    ) {
      issues.push({
        code: 'STOCK_PLAN_CLASS_MISMATCH',
        message: `${source.canonicalObjectType} ${source.data.id} stock plan ${planId} does not include stock class ${classId}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'stock_plan_id',
        stockPlanId: planId,
        stockClassId: classId,
      });
    }
  }

  for (const source of indexed.filter((item) => item.canonicalObjectType === 'TX_STOCK_PLAN_RETURN_TO_POOL')) {
    const securityId = source.data.security_id;
    const returnPlanId = source.data.stock_plan_id;
    if (
      typeof securityId !== 'string' ||
      securityId.length === 0 ||
      typeof returnPlanId !== 'string' ||
      returnPlanId.length === 0
    ) {
      continue;
    }
    if (!validObservedSecurityProducers.has(source)) continue;
    const rootFacts = rootFactsForSecurity(securityId);
    if (!rootFacts.hasRoot) continue;
    if (rootFacts.hasNonPlanRoot) {
      issues.push({
        code: 'STOCK_PLAN_SECURITY_MISMATCH',
        message: `${source.canonicalObjectType} ${source.data.id} returns security ${securityId} to stock plan ${returnPlanId}, but its lineage includes a non-plan issuance`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'security_id.stock_plan_id',
        stockPlanId: returnPlanId,
        securityId,
      });
    }
  }

  for (const issuance of indexed.filter((item) =>
    ['TX_CONVERTIBLE_ISSUANCE', 'TX_WARRANT_ISSUANCE'].includes(item.canonicalObjectType)
  )) {
    const issuanceField =
      issuance.canonicalObjectType === 'TX_CONVERTIBLE_ISSUANCE' ? 'conversion_triggers' : 'exercise_triggers';
    for (const [triggerId, count] of triggerIdCounts(issuance.data, issuanceField)) {
      if (count <= 1) continue;
      issues.push({
        code: 'DUPLICATE_TRIGGER_ID',
        message: `${issuance.canonicalObjectType} ${issuance.data.id} has duplicate trigger ${triggerId}`,
        objectType: issuance.canonicalObjectType,
        objectId: issuance.data.id,
        path: issuanceField,
        referenceId: triggerId,
        count,
      });
    }
  }

  const validateTransactionTrigger = (transactionType: string, family: SecurityFamily, issuanceField: string): void => {
    for (const transition of transitionInstances.filter(
      (item) => item.source.canonicalObjectType === transactionType && validTransitions.has(item)
    )) {
      const { source } = transition;
      if (typeof source.data.security_id !== 'string' || typeof source.data.trigger_id !== 'string') continue;
      const root = rootFactsForSecurity(source.data.security_id).uniqueRoot;
      if (root?.family !== family) continue;
      const triggerCount = triggerIdCounts(root.source.data, issuanceField).get(source.data.trigger_id) ?? 0;
      if (triggerCount === 0) {
        issues.push({
          code: 'MISSING_TRIGGER',
          message: `${source.canonicalObjectType} ${source.data.id} references missing trigger ${source.data.trigger_id}`,
          objectType: source.canonicalObjectType,
          objectId: source.data.id,
          path: 'trigger_id',
          referenceId: source.data.trigger_id,
          targetObjectTypes: [ISSUANCE_OBJECT_TYPE_BY_FAMILY[family]],
        });
      } else if (triggerCount > 1) {
        issues.push({
          code: 'AMBIGUOUS_TRIGGER',
          message: `${source.canonicalObjectType} ${source.data.id} references ambiguous trigger ${source.data.trigger_id}`,
          objectType: source.canonicalObjectType,
          objectId: source.data.id,
          path: 'trigger_id',
          referenceId: source.data.trigger_id,
          targetObjectTypes: [ISSUANCE_OBJECT_TYPE_BY_FAMILY[family]],
          count: triggerCount,
        });
      }
    }
  };
  validateTransactionTrigger('TX_CONVERTIBLE_CONVERSION', 'convertible', 'conversion_triggers');
  validateTransactionTrigger('TX_WARRANT_EXERCISE', 'warrant', 'exercise_triggers');

  for (const source of indexed.filter((item) =>
    ['TX_VESTING_EVENT', 'TX_VESTING_START'].includes(item.canonicalObjectType)
  )) {
    if (typeof source.data.security_id !== 'string' || typeof source.data.vesting_condition_id !== 'string') continue;
    if (!validObservedSecurityProducers.has(source)) continue;
    const rootFacts = rootFactsForSecurity(source.data.security_id);
    if (!rootFacts.hasRoot) continue;
    const { vestingTermsIds } = rootFacts;
    if (vestingTermsIds.length === 0 || rootFacts.hasMissingVestingTerms) {
      issues.push({
        code: 'MISSING_VESTING_TERMS',
        message: `${source.canonicalObjectType} ${source.data.id} security ${source.data.security_id} has no vesting terms`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'security_id.vesting_terms_id',
        securityId: source.data.security_id,
        targetObjectTypes: ['VESTING_TERMS'],
      });
      continue;
    }
    if (vestingTermsIds.length > 1) {
      const firstVestingTermsId = requireFirst(vestingTermsIds, 'ambiguous vesting terms must have a first id');
      const secondVestingTermsId = requireFirst(
        vestingTermsIds.slice(1),
        'ambiguous vesting terms must have a second id'
      );
      issues.push({
        code: 'AMBIGUOUS_VESTING_TERMS',
        message: `${source.canonicalObjectType} ${source.data.id} security ${source.data.security_id} has multiple vesting terms`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'security_id.vesting_terms_id',
        securityId: source.data.security_id,
        targetObjectTypes: ['VESTING_TERMS'],
        witnessVestingTermsIds: [firstVestingTermsId, secondVestingTermsId],
      });
      continue;
    }
    const vestingTermsId = requireFirst(vestingTermsIds, 'vesting terms id must be present');
    const vestingTermsMatches = objectsByKey.get(objectKey('VESTING_TERMS', vestingTermsId)) ?? [];
    if (vestingTermsMatches.length !== 1) continue;
    const conditions = requireFirst(vestingTermsMatches, 'vesting terms match must be present').data.vesting_conditions;
    const matchingConditions = Array.isArray(conditions)
      ? conditions
          .map(asRecord)
          .filter(
            (candidate): candidate is Readonly<Record<string, unknown>> =>
              candidate?.id === source.data.vesting_condition_id
          )
      : [];
    if (matchingConditions.length === 0) {
      issues.push({
        code: 'MISSING_VESTING_CONDITION',
        message: `${source.canonicalObjectType} ${source.data.id} references missing vesting condition ${source.data.vesting_condition_id}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'vesting_condition_id',
        referenceId: source.data.vesting_condition_id,
        targetObjectTypes: ['VESTING_TERMS'],
      });
      continue;
    }
    if (matchingConditions.length !== 1) continue;
    const condition = requireFirst(matchingConditions, 'matching vesting condition must be present');
    const expectedTriggerType =
      source.canonicalObjectType === 'TX_VESTING_START' ? 'VESTING_START_DATE' : 'VESTING_EVENT';
    const triggerType = asRecord(condition.trigger)?.type;
    if (triggerType !== expectedTriggerType) {
      issues.push({
        code: 'VESTING_TRIGGER_MISMATCH',
        message: `${source.canonicalObjectType} ${source.data.id} references vesting condition ${source.data.vesting_condition_id} with trigger ${String(triggerType)}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'vesting_condition_id',
        referenceId: source.data.vesting_condition_id,
        targetObjectTypes: ['VESTING_TERMS'],
      });
    }
  }

  for (const source of indexed.filter((item) => item.canonicalObjectType === 'DOCUMENT')) {
    if (!Array.isArray(source.data.related_objects)) continue;
    source.data.related_objects.forEach((reference, index) => {
      const record = asRecord(reference);
      if (typeof record?.object_type !== 'string' || typeof record.object_id !== 'string') return;
      const capability = getOcfObjectTypeCapability(record.object_type);
      if (capability.support === 'schema-only') {
        issues.push({
          code: 'SCHEMA_ONLY_REFERENCE',
          message: `${source.canonicalObjectType} ${source.data.id} cannot reference schema-only ${record.object_type} ${record.object_id}`,
          objectType: source.canonicalObjectType,
          objectId: source.data.id,
          path: `related_objects[${index}].object_type`,
          referenceId: record.object_id,
          targetObjectTypes: [record.object_type],
        });
        return;
      }
      const targetType = canonicalObjectType(record.object_type);
      if (!hasObject([targetType], record.object_id)) {
        issues.push(
          missingReferenceIssue(source, `related_objects[${index}].object_id`, record.object_id, [targetType])
        );
      }
    });
  }

  issues.sort((left, right) => compareText(issueSortKey(left), issueSortKey(right)));
  const frozenIssues = issues.map(freezeIssue);
  if (frozenIssues.length === 0) {
    const emptyIssues: readonly [] = Object.freeze([]);
    return Object.freeze({ valid: true, issues: emptyIssues });
  }
  const firstIssue = requireFirst(frozenIssues, 'invalid result must contain an issue');
  const nonEmptyIssues: [OcfCapTableSnapshotIssue, ...OcfCapTableSnapshotIssue[]] = [
    firstIssue,
    ...frozenIssues.slice(1),
  ];
  Object.freeze(nonEmptyIssues);
  return Object.freeze({ valid: false, issues: nonEmptyIssues });
}
