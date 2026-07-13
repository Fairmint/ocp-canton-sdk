import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  buildUpdateCapTableCommand,
  isOcfCreatableEntityType,
  isOcfDeletableEntityType,
  isOcfEditableEntityType,
  OcpClient,
  type OcfCreateArguments,
  type OcfDataTypeFor,
  type OcfEditArguments,
  type OcfEntityType,
} from '../../src';
import { OcpValidationError } from '../../src/errors';
import { ENTITY_REGISTRY, ENTITY_TAG_MAP } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import {
  buildOcfCreateData,
  buildOcfDeleteData,
  buildOcfEditData,
} from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { parseOcfEntityInput, parseOcfObject } from '../../src/utils/ocfZodSchemas';
import { loadFixture, stripSourceMetadata } from '../utils/productionFixtures';

function loadEntityFixture<T extends OcfEntityType>(
  entityType: T,
  relativePath: string
): readonly [type: T, data: OcfDataTypeFor<T>] {
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
  loadEntityFixture('financing', 'production/financing/basic.json'),
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
  test('does not expose converted payloads when generated decoding fails', () => {
    const stakeholderArgs = loadEntityFixture('stakeholder', 'production/stakeholder/individual.json');
    const { decoder } = Fairmint.OpenCapTable.CapTable.OcfCreateData;
    const decoderSpy = jest.spyOn(decoder, 'runWithException').mockImplementationOnce(() => {
      throw new Error('forced decoder failure');
    });

    try {
      buildOcfCreateData(...stakeholderArgs);
      throw new Error('Expected generated operation decoding to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        fieldPath: 'batch.create.stakeholder',
        receivedValue: undefined,
        context: expect.objectContaining({
          operation: 'create',
          entityType: 'stakeholder',
        }),
      });
      expect(JSON.stringify(error)).not.toContain(stakeholderArgs[1].id);
    } finally {
      decoderSpy.mockRestore();
    }
  });

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

  test.each(editCases)(
    'reads a valid $entityType payload through both getEntityAsOcf and the OcpClient namespace',
    async ({ entityType, args }) => {
      const [, fixture] = args;
      const edit = buildOcfEditData(...args);
      const registryEntry = ENTITY_REGISTRY[entityType];
      const contractId = `positive-read-${entityType}`;
      const readAs = [`reader::${entityType}`];
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: registryEntry.templateId,
            createArgument: { [registryEntry.dataField]: edit.value },
          },
        },
      });
      const ledger = { getEventsByContractId } as unknown as LedgerJsonApiClient;

      const direct = await getEntityAsOcf(ledger, entityType, contractId, { readAs });
      const viaNamespace = await new OcpClient({ ledger }).OpenCapTable[entityType].get({ contractId, readAs });

      expect(direct).toMatchObject({
        contractId,
        data: {
          id: fixture.id,
          object_type: registryEntry.objectType,
        },
      });
      expect(viaNamespace).toEqual(direct);
      expect(getEventsByContractId).toHaveBeenNthCalledWith(1, { contractId, readAs });
      expect(getEventsByContractId).toHaveBeenNthCalledWith(2, { contractId, readAs });

      if (entityType === 'stockIssuance') {
        expect(direct.data).not.toHaveProperty('share_numbers_issued');
        expect(direct.data).not.toHaveProperty('comments');
      }
    }
  );

  test.each(deleteCases)('constructs and decodes the $entityType delete variant', ({ entityType }) => {
    const id = `${entityType}-generated-delete-id`;
    const deletion = buildOcfDeleteData(entityType, id);

    expect(deletion).toEqual({ tag: ENTITY_TAG_MAP[entityType].delete, value: id });
    expect(Fairmint.OpenCapTable.CapTable.OcfDeleteData.decoder.runWithException(deletion)).toEqual(deletion);
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
