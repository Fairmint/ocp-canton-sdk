import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpValidationError } from '../../src/errors';
import { buildApplyCommand, CapTableApply, readApplyResult } from '../../src/functions/OpenCapTable/capTable/apply';
import { convertToDaml, convertToDamlData } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { resolveInputs } from '../../src/register/inputs';
import type { ApplyOperation } from '../../src/types/register';
import { baseBook, stakeholder } from '../register/bookFixtures';
import {
  ANCHOR,
  ANCHOR_TEMPLATE_ID,
  anchorExercise,
  DAML_INPUTS,
  decodeChoice,
  exerciseOf,
  INPUTS,
  issuance,
  STAKEHOLDER,
  transaction,
  TRANSFER,
  TRANSFER_AGENT,
} from './capTableFixtures';

const PARAMS = { capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT, inputs: INPUTS };

function applyArgument(command: { command: unknown }): Fairmint.OpenCapTable.CapTable.CapTable_Apply {
  return decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_Apply, exerciseOf(command).choiceArgument);
}

const APPLY_RESULT = {
  records: [
    ['ISS-S-B1', { tag: 'OcfRecordCidStockIssuance', value: 'cid-ISS-S-B1' }],
    ['SH-B', { tag: 'OcfRecordCidStakeholder', value: 'cid-SH-B' }],
    ['TR-1', { tag: 'OcfRecordCidStockTransfer', value: 'cid-TR-1' }],
  ],
  states: [['S-B1', 'state-S-B1']],
  epochs: [],
  shards: [
    ['00000000', 'shard-a'],
    ['10000000', 'shard-b'],
  ],
};

describe('CapTableApply', () => {
  it('builds CapTable_Apply on the anchor as the transfer agent, each operation in its generated shape', () => {
    const toBuyer = issuance({ id: 'ISS-S-B1', security_id: 'S-B1', stakeholder_id: 'SH-B', quantity: '400' });
    const balance = issuance({ id: 'ISS-S-A2', security_id: 'S-A2', quantity: '600' });
    const consolidation = {
      object_type: 'TX_STOCK_CONSOLIDATION' as const,
      id: 'CON-1',
      date: '2025-04-01',
      security_ids: ['S-A2', 'S-A3'],
      resulting_security_id: 'S-A4',
    };
    const consolidated = issuance({ id: 'ISS-S-A4', security_id: 'S-A4', quantity: '700' });

    const command = new CapTableApply(PARAMS)
      .create('stakeholder', STAKEHOLDER)
      .stockTransfer({ transfer: TRANSFER, resulting: [toBuyer], balance })
      .stockConsolidation({ consolidation, resultingIssuance: consolidated })
      .vestingSnapshot({ securityId: 'S-V1', asOf: '2025-03-01', vested: '40.50' })
      .preSplitShard('00000000')
      .build();

    expect(command.actAs).toEqual([TRANSFER_AGENT]);
    expect(command.disclosedContracts).toEqual([]);
    expect(exerciseOf(command)).toMatchObject({
      templateId: OCP_TEMPLATES.capTable,
      contractId: ANCHOR,
      choice: 'CapTable_Apply',
    });
    const argument = applyArgument(command);
    expect(argument.inputs).toEqual(DAML_INPUTS);
    expect(argument.operations).toEqual([
      { tag: 'ApplyRecord', value: convertToDaml('stakeholder', STAKEHOLDER) },
      {
        tag: 'ApplyStockTransfer',
        value: {
          transfer: convertToDamlData('stockTransfer', TRANSFER),
          resulting: [convertToDamlData('stockIssuance', toBuyer)],
          balance: convertToDamlData('stockIssuance', balance),
        },
      },
      {
        tag: 'ApplyStockConsolidation',
        value: {
          consolidation: convertToDamlData('stockConsolidation', consolidation),
          resulting_issuance: convertToDamlData('stockIssuance', consolidated),
        },
      },
      { tag: 'ApplyVestingSnapshot', value: { security_id: 'S-V1', as_of: '2025-03-01', vested: '40.5' } },
      { tag: 'ApplyPreSplitShard', value: { prefix: '00000000' } },
    ]);
  });

  it('writes the bundled events without a balance as None and uses the ledger template ID when given', () => {
    const cancellation = {
      object_type: 'TX_STOCK_CANCELLATION' as const,
      id: 'CAN-1',
      date: '2025-03-01',
      security_id: 'S-A1',
      quantity: '1000',
      reason_text: 'Forfeited',
    };
    const repurchase = {
      object_type: 'TX_STOCK_REPURCHASE' as const,
      id: 'REP-1',
      date: '2025-03-01',
      security_id: 'S-A5',
      quantity: '10',
      price: { amount: '1', currency: 'USD' },
    };
    const command = new CapTableApply({ ...PARAMS, capTableTemplateId: ANCHOR_TEMPLATE_ID })
      .stockCancellation({ cancellation })
      .stockRepurchase({ repurchase, balance: null })
      .build();

    expect(exerciseOf(command).templateId).toBe(ANCHOR_TEMPLATE_ID);
    const [first, second] = applyArgument(command).operations;
    expect(first).toEqual({
      tag: 'ApplyStockCancellation',
      value: { cancellation: convertToDamlData('stockCancellation', cancellation), balance: null },
    });
    expect(second).toEqual({
      tag: 'ApplyStockRepurchase',
      value: { repurchase: convertToDamlData('stockRepurchase', repurchase), balance: null },
    });
  });

  it('refuses an empty batch and one over 500 operations with the ledger messages', () => {
    expect(() => new CapTableApply(PARAMS).build()).toThrow('CapTable_Apply needs at least one operation');
    const batch = new CapTableApply(PARAMS);
    for (let index = 0; index <= 500; index++) batch.preSplitShard('00000000');
    expect(batch.size).toBe(501);
    expect(() => batch.build()).toThrow('CapTable_Apply takes at most 500 operations');
  });

  it.each([
    ['issuer', 'the issuer record is written when the cap table is created and edited by CapTable_Restate'],
    ['stockHold', 'holds are placed by CapTable_PlaceHolds'],
    ['stockHoldCancellation', 'holds are canceled by CapTable_CancelHolds or CapTable_Settle'],
    ['stockTransfer', 'write a stock transfer with ApplyStockTransfer'],
    ['stockConsolidation', 'write a stock consolidation with ApplyStockConsolidation'],
  ])('refuses a %s written as a plain record', (type, message) => {
    const operation = { kind: 'record', type, data: TRANSFER } as unknown as ApplyOperation;
    expect(() => new CapTableApply(PARAMS).operation(operation)).toThrow(message);
  });

  it('refuses a consolidation without securities, over 50 or naming one twice', () => {
    const base = {
      object_type: 'TX_STOCK_CONSOLIDATION' as const,
      id: 'CON-1',
      date: '2025-04-01',
      resulting_security_id: 'S-R',
    };
    const resultingIssuance = issuance({ id: 'ISS-S-R', security_id: 'S-R' });
    const add = (security_ids: string[]) => () =>
      new CapTableApply(PARAMS).stockConsolidation({
        consolidation: { ...base, security_ids },
        resultingIssuance,
      });
    expect(add(['S-1', 'S-1'])).toThrow('a consolidation names each security once');
    expect(add(Array.from({ length: 51 }, (_, index) => `S-${index}`))).toThrow(
      'a consolidation takes at most 50 securities'
    );
  });

  it('checks a pre-built operation exactly and fails a malformed record at its call', () => {
    const batch = new CapTableApply(PARAMS);
    expect(() =>
      batch.operation({ kind: 'preSplitShard', prefix: '00000000', extra: true } as unknown as ApplyOperation)
    ).toThrow('Unexpected preSplitShard operation field extra');
    expect(() => batch.operation({ kind: 'stockTransfer', transfer: TRANSFER } as unknown as ApplyOperation)).toThrow(
      'stockTransfer operation is missing required field resulting'
    );
    expect(() => batch.operation({ kind: 'merge' } as unknown as ApplyOperation)).toThrow(
      'Unknown CapTable_Apply operation kind'
    );
    expect(() => batch.preSplitShard('0101')).toThrow('A shard prefix is 8 to 256 bits');
    expect(() => batch.vestingSnapshot({ securityId: 'S-V1', asOf: '2025-3-1', vested: '1' })).toThrow(
      OcpValidationError
    );
    expect(batch.isEmpty).toBe(true);
  });

  it('builds the same command from a list', () => {
    const operations: ApplyOperation[] = [
      { kind: 'record', type: 'stakeholder', data: STAKEHOLDER },
      { kind: 'preSplitShard', prefix: '11111111' },
    ];
    expect(buildApplyCommand(PARAMS, operations)).toEqual(
      new CapTableApply(PARAMS).create('stakeholder', STAKEHOLDER).preSplitShard('11111111').build()
    );
  });

  it('resolves the inputs from a key index when none are given', () => {
    const index = baseBook().index();
    const operations: ApplyOperation[] = [
      { kind: 'record', type: 'stakeholder', data: stakeholder('SH-N') },
      { kind: 'vestingSnapshot', securityId: 'S-A1', asOf: '2025-03-01', vested: '1' },
    ];
    const { inputs } = resolveInputs(index, { kind: 'apply', operations });
    const built = buildApplyCommand({ capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT, index }, operations);

    expect(applyArgument(built).inputs).toEqual({
      states: inputs.states,
      epochs: inputs.epochs,
      shards: inputs.shards,
      records: [],
    });
    expect(inputs.states).toEqual(['state-S-A1']);
    expect(
      applyArgument(
        new CapTableApply({ capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT, index, inputs: INPUTS })
          .create('stakeholder', STAKEHOLDER)
          .build()
      ).inputs
    ).toEqual(DAML_INPUTS);
    expect(() =>
      new CapTableApply({ capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT, index })
        .create('stakeholder', stakeholder('SH-A'))
        .build()
    ).toThrow('ID already used: SH-A');
    expect(() =>
      new CapTableApply({ capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT })
        .create('stakeholder', STAKEHOLDER)
        .build()
    ).toThrow('Give the batch its inputs, or a key index to resolve them from');
  });

  it('keeps per-operation metadata and clears', () => {
    const batch = new CapTableApply(PARAMS)
      .create('stakeholder', STAKEHOLDER)
      .stockTransfer({ transfer: TRANSFER, resulting: [issuance({ id: 'ISS-S-B1', security_id: 'S-B1' })] })
      .vestingSnapshot({ securityId: 'S-V1', asOf: '2025-03-01', vested: '1' });
    expect(batch.getDetailedSummary()).toEqual([
      { index: 0, kind: 'record', entityType: 'stakeholder', id: 'SH-B' },
      { index: 1, kind: 'stockTransfer', entityType: 'stockTransfer', id: 'TR-1', securityId: 'S-A1' },
      { index: 2, kind: 'vestingSnapshot', securityId: 'S-V1' },
    ]);
    expect(batch.clear().isEmpty).toBe(true);
  });
});

describe('readApplyResult', () => {
  it('decodes what the batch created', () => {
    const result = readApplyResult(transaction([anchorExercise('CapTable_Apply', APPLY_RESULT)]));

    expect([...result.records]).toEqual([
      ['ISS-S-B1', { entityType: 'stockIssuance', contractId: 'cid-ISS-S-B1' }],
      ['SH-B', { entityType: 'stakeholder', contractId: 'cid-SH-B' }],
      ['TR-1', { entityType: 'stockTransfer', contractId: 'cid-TR-1' }],
    ]);
    expect([...result.states]).toEqual([['S-B1', 'state-S-B1']]);
    expect(result.epochs.size).toBe(0);
    expect([...result.shards.keys()]).toEqual(['00000000', '10000000']);
  });

  it('finds the result on the anchor and refuses a transaction without one', () => {
    const response = transaction([anchorExercise('CapTable_Apply', APPLY_RESULT)]);
    expect(readApplyResult(response, { capTableContractId: ANCHOR }).states.get('S-B1')).toBe('state-S-B1');
    expect(() => readApplyResult(response, { capTableContractId: 'other-anchor' })).toThrow(
      'CapTable_Apply result not found in transaction'
    );
  });

  it('refuses a result that does not decode', () => {
    const response = transaction([
      anchorExercise('CapTable_Apply', { ...APPLY_RESULT, records: [['X', { tag: 'Nope', value: 'cid' }]] }),
    ]);
    expect(() => readApplyResult(response)).toThrow('Invalid generated DAML data at CapTable_Apply.exerciseResult');
  });
});
