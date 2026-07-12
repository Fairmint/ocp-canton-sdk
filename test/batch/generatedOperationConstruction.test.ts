import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  buildUpdateCapTableCommand,
  isOcfCreatableEntityType,
  isOcfDeletableEntityType,
  isOcfEditableEntityType,
  type OcfCreateArguments,
  type OcfEditArguments,
  type OcfEntityType,
  type OcfWritableDataTypeFor,
} from '../../src';
import { ENTITY_REGISTRY, ENTITY_TAG_MAP } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfDeleteData,
  buildOcfDeleteDataFromOperation,
  buildOcfEditData,
  buildOcfEditDataFromOperation,
} from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { parseOcfEntityInput, parseOcfObject } from '../../src/utils/ocfZodSchemas';
import { loadFixture, stripSourceMetadata } from '../utils/productionFixtures';

function loadEntityFixture<T extends OcfEntityType>(
  entityType: T,
  relativePath: string
): readonly [type: T, data: OcfWritableDataTypeFor<T>] {
  const fixture = stripSourceMetadata(loadFixture<Record<string, unknown>>(relativePath));
  const canonicalFixture = parseOcfObject(fixture);
  return [entityType, parseOcfEntityInput(entityType, canonicalFixture)];
}

const editableFixtures: readonly OcfEditArguments[] = [
  loadEntityFixture('convertibleAcceptance', 'synthetic/convertibleAcceptance.json'),
  loadEntityFixture('convertibleCancellation', 'production/convertibleCancellation.json'),
  loadEntityFixture('convertibleConversion', 'production/convertibleConversion.json'),
  loadEntityFixture('convertibleIssuance', 'production/convertibleIssuance/safe-post-money.json'),
  loadEntityFixture('convertibleRetraction', 'synthetic/convertibleRetraction.json'),
  loadEntityFixture('convertibleTransfer', 'production/convertibleTransfer.json'),
  loadEntityFixture('document', 'production/document/basic.json'),
  loadEntityFixture('equityCompensationAcceptance', 'synthetic/equityCompensationAcceptance.json'),
  loadEntityFixture('equityCompensationCancellation', 'production/equityCompensationCancellation.json'),
  loadEntityFixture('equityCompensationExercise', 'production/equityCompensationExercise.json'),
  loadEntityFixture('equityCompensationIssuance', 'production/equityCompensationIssuance/option-iso.json'),
  loadEntityFixture('equityCompensationRelease', 'synthetic/equityCompensationRelease.json'),
  loadEntityFixture('equityCompensationRepricing', 'synthetic/equityCompensationRepricing.json'),
  loadEntityFixture('equityCompensationRetraction', 'synthetic/equityCompensationRetraction.json'),
  loadEntityFixture('equityCompensationTransfer', 'synthetic/equityCompensationTransfer.json'),
  loadEntityFixture('issuer', 'production/issuer/basic.json'),
  loadEntityFixture('issuerAuthorizedSharesAdjustment', 'production/issuerAuthorizedSharesAdjustment.json'),
  loadEntityFixture('stakeholder', 'production/stakeholder/individual.json'),
  loadEntityFixture('stakeholderRelationshipChangeEvent', 'synthetic/stakeholderRelationshipChangeEvent.json'),
  loadEntityFixture('stakeholderStatusChangeEvent', 'synthetic/stakeholderStatusChangeEvent.json'),
  loadEntityFixture('stockAcceptance', 'synthetic/stockAcceptance.json'),
  loadEntityFixture('stockCancellation', 'production/stockCancellation.json'),
  loadEntityFixture('stockClass', 'production/stockClass/common.json'),
  loadEntityFixture('stockClassAuthorizedSharesAdjustment', 'production/stockClassAuthorizedSharesAdjustment.json'),
  loadEntityFixture('stockClassConversionRatioAdjustment', 'synthetic/stockClassConversionRatioAdjustment.json'),
  loadEntityFixture('stockClassSplit', 'production/stockClassSplit.json'),
  loadEntityFixture('stockConsolidation', 'synthetic/stockConsolidation.json'),
  loadEntityFixture('stockConversion', 'synthetic/stockConversion.json'),
  loadEntityFixture('stockIssuance', 'production/stockIssuance/founders-stock.json'),
  loadEntityFixture('stockLegendTemplate', 'production/stockLegendTemplate/rule-144.json'),
  loadEntityFixture('stockPlan', 'production/stockPlan/basic.json'),
  loadEntityFixture('stockPlanPoolAdjustment', 'production/stockPlanPoolAdjustment.json'),
  loadEntityFixture('stockPlanReturnToPool', 'synthetic/stockPlanReturnToPool.json'),
  loadEntityFixture('stockReissuance', 'synthetic/stockReissuance.json'),
  loadEntityFixture('stockRepurchase', 'production/stockRepurchase.json'),
  loadEntityFixture('stockRetraction', 'synthetic/stockRetraction.json'),
  loadEntityFixture('stockTransfer', 'production/stockTransfer.json'),
  loadEntityFixture('valuation', 'production/valuation/409a.json'),
  loadEntityFixture('vestingAcceleration', 'synthetic/vestingAcceleration.json'),
  loadEntityFixture('vestingEvent', 'synthetic/vestingEvent.json'),
  loadEntityFixture('vestingStart', 'production/vestingStart.json'),
  loadEntityFixture('vestingTerms', 'production/vestingTerms/time-based-cliff.json'),
  loadEntityFixture('warrantAcceptance', 'synthetic/warrantAcceptance.json'),
  loadEntityFixture('warrantCancellation', 'synthetic/warrantCancellation.json'),
  loadEntityFixture('warrantExercise', 'synthetic/warrantExercise.json'),
  loadEntityFixture('warrantIssuance', 'production/warrantIssuance.json'),
  loadEntityFixture('warrantRetraction', 'synthetic/warrantRetraction.json'),
  loadEntityFixture('warrantTransfer', 'synthetic/warrantTransfer.json'),
];

const creatableFixtures = editableFixtures.filter((args): args is OcfCreateArguments =>
  isOcfCreatableEntityType(args[0])
);
const deletableEntityTypes = Object.keys(ENTITY_REGISTRY).filter(isOcfDeletableEntityType);

const createCases = creatableFixtures.map((args) => ({ entityType: args[0], args }));
const editCases = editableFixtures.map((args) => ({ entityType: args[0], args }));
const deleteCases = deletableEntityTypes.map((entityType) => ({ entityType }));

describe('generated DAML batch operation construction', () => {
  test('fixture matrix covers every generated operation capability exactly once', () => {
    const expectedCreatableTypes = Object.keys(ENTITY_REGISTRY).filter(isOcfCreatableEntityType).sort();
    const expectedEditableTypes = Object.keys(ENTITY_REGISTRY).filter(isOcfEditableEntityType).sort();
    const expectedDeletableTypes = Object.keys(ENTITY_REGISTRY).filter(isOcfDeletableEntityType).sort();

    expect(createCases.map(({ entityType }) => entityType).sort()).toEqual(expectedCreatableTypes);
    expect(editCases.map(({ entityType }) => entityType).sort()).toEqual(expectedEditableTypes);
    expect(deleteCases.map(({ entityType }) => entityType).sort()).toEqual(expectedDeletableTypes);
    expect(new Set(createCases.map(({ entityType }) => entityType)).size).toBe(createCases.length);
    expect(new Set(editCases.map(({ entityType }) => entityType)).size).toBe(editCases.length);
  });

  test.each(createCases)('constructs and decodes the $entityType create variant', ({ entityType, args }) => {
    const create = buildOcfCreateData(...args);

    expect(create.tag).toBe(ENTITY_TAG_MAP[entityType].create);
    expect(Fairmint.OpenCapTable.CapTable.OcfCreateData.decoder.runWithException(create)).toEqual(create);
  });

  test.each(editCases)('constructs and decodes the $entityType edit variant', ({ entityType, args }) => {
    const edit = buildOcfEditData(...args);

    expect(edit.tag).toBe(ENTITY_TAG_MAP[entityType].edit);
    expect(Fairmint.OpenCapTable.CapTable.OcfEditData.decoder.runWithException(edit)).toEqual(edit);
  });

  test.each(deleteCases)('constructs and decodes the $entityType delete variant', ({ entityType }) => {
    const id = `${entityType}-generated-delete-id`;
    const deletion = buildOcfDeleteData(entityType, id);

    expect(deletion).toEqual({ tag: ENTITY_TAG_MAP[entityType].delete, value: id });
    expect(Fairmint.OpenCapTable.CapTable.OcfDeleteData.decoder.runWithException(deletion)).toEqual(deletion);
  });

  test('rejects unsupported tuple and operation kinds before reading their payloads', () => {
    let payloadWasRead = false;
    const poisonPayload = new Proxy<Record<string, never>>(
      {},
      {
        get() {
          payloadWasRead = true;
          throw new Error('converter must not read an unsupported payload');
        },
      }
    );
    const untypedCreate = buildOcfCreateData as unknown as (type: string, data: unknown) => unknown;
    const untypedCreateOperation = buildOcfCreateDataFromOperation as unknown as (operation: {
      type: string;
      data: unknown;
    }) => unknown;
    const untypedEdit = buildOcfEditData as unknown as (type: string, data: unknown) => unknown;
    const untypedEditOperation = buildOcfEditDataFromOperation as unknown as (operation: {
      type: string;
      data: unknown;
    }) => unknown;
    const untypedDelete = buildOcfDeleteData as unknown as (type: string, id: string) => unknown;
    const untypedDeleteOperation = buildOcfDeleteDataFromOperation as unknown as (operation: {
      type: string;
      readonly id: string;
    }) => unknown;
    const unsupportedDeleteOperation = {
      type: 'issuer',
      get id(): string {
        payloadWasRead = true;
        throw new Error('builder must not read an unsupported identifier');
      },
    };

    expect(() => untypedCreate('issuer', poisonPayload)).toThrow(
      'Create operation not supported for entity type: issuer'
    );
    expect(() => untypedCreateOperation({ type: 'issuer', data: poisonPayload })).toThrow(
      'Create operation not supported for entity type: issuer'
    );
    expect(() => untypedEdit('not-real', poisonPayload)).toThrow(
      'Edit operation not supported for entity type: not-real'
    );
    expect(() => untypedEditOperation({ type: 'not-real', data: poisonPayload })).toThrow(
      'Edit operation not supported for entity type: not-real'
    );
    expect(() => untypedDelete('issuer', 'unsupported-delete-id')).toThrow(
      'Delete operation not supported for entity type: issuer'
    );
    expect(() => untypedDeleteOperation(unsupportedDeleteOperation)).toThrow(
      'Delete operation not supported for entity type: issuer'
    );
    expect(payloadWasRead).toBe(false);
  });

  test('constructs correlated operation objects without rebuilding asserted tuples', () => {
    const stakeholder = parseOcfEntityInput(
      'stakeholder',
      parseOcfObject(
        stripSourceMetadata(loadFixture<Record<string, unknown>>('production/stakeholder/individual.json'))
      )
    );
    const { command } = buildUpdateCapTableCommand(
      { capTableContractId: 'cap-table-generated-operation-1' },
      {
        creates: [{ type: 'stakeholder', data: stakeholder }],
        edits: [{ type: 'stakeholder', data: stakeholder }],
        deletes: [{ type: 'stakeholder', id: stakeholder.id }],
      }
    );

    if (!('ExerciseCommand' in command)) {
      throw new Error('Expected an ExerciseCommand');
    }

    const operations = Fairmint.OpenCapTable.CapTable.UpdateCapTable.decoder.runWithException(
      command.ExerciseCommand.choiceArgument
    );
    expect(operations.creates[0]?.tag).toBe('OcfCreateStakeholder');
    expect(operations.edits[0]?.tag).toBe('OcfEditStakeholder');
    expect(operations.deletes[0]).toEqual({ tag: 'OcfDeleteStakeholder', value: stakeholder.id });
  });
});
