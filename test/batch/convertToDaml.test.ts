/**
 * convertToDaml returns the register's `OcfRecordData` variant; convertToDamlData its bare `<Name>OcfData` payload.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { decodeDamlEntityData } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml, convertToDamlData } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import type {
  OcfFinancing,
  OcfStakeholder,
  OcfStockClass,
  OcfStockIssuance,
  OcfStockPlan,
  OcfStockTransfer,
  OcfValuation,
} from '../../src/types/native';

const { OcfRecordData } = Fairmint.OpenCapTable.OcfRecords;

const stakeholder: OcfStakeholder = {
  object_type: 'STAKEHOLDER',
  id: 'sh-1',
  name: { legal_name: 'Ada Lovelace' },
  stakeholder_type: 'INDIVIDUAL',
};

const stockClass: OcfStockClass = {
  object_type: 'STOCK_CLASS',
  id: 'sc-1',
  name: 'Common',
  class_type: 'COMMON',
  default_id_prefix: 'CS',
  initial_shares_authorized: '10000000',
  votes_per_share: '1',
  seniority: '1',
  conversion_rights: [],
};

const stockIssuance: OcfStockIssuance = {
  object_type: 'TX_STOCK_ISSUANCE',
  id: 'si-1',
  date: '2025-02-03',
  security_id: 'sec-1',
  custom_id: 'CS-1',
  stakeholder_id: 'sh-1',
  stock_class_id: 'sc-1',
  share_price: { amount: '1', currency: 'USD' },
  quantity: '100',
  security_law_exemptions: [],
  stock_legend_ids: [],
};

const stockTransfer: OcfStockTransfer = {
  object_type: 'TX_STOCK_TRANSFER',
  id: 'st-1',
  date: '2025-02-04',
  security_id: 'sec-1',
  quantity: '40',
  resulting_security_ids: ['sec-2'],
  balance_security_id: 'sec-3',
};

const stockPlan: OcfStockPlan = {
  object_type: 'STOCK_PLAN',
  id: 'sp-1',
  plan_name: 'Pool',
  initial_shares_reserved: '1000',
  stock_class_ids: ['sc-1'],
  default_cancellation_behavior: 'RETURN_TO_POOL',
};

const valuation: OcfValuation = {
  object_type: 'VALUATION',
  id: 'val-1',
  stock_class_id: 'sc-1',
  price_per_share: { amount: '3.5', currency: 'USD' },
  effective_date: '2025-03-15',
  valuation_type: '409A',
};

const financing: OcfFinancing = {
  object_type: 'FINANCING',
  id: 'fin-1',
  name: 'Series A',
  issuance_ids: ['si-1'],
  date: '2025-01-15',
};

describe('convertToDaml and convertToDamlData', () => {
  it('wraps the payload in the OcfRecordData constructor registered for the entity kind', () => {
    const record = convertToDaml('stockClass', stockClass);

    expect(record).toEqual({ tag: 'OcfRecordDataStockClass', value: convertToDamlData('stockClass', stockClass) });
    expect(record.tag).toBe(ENTITY_REGISTRY.stockClass.recordTag);
  });

  it('returns the bare payload from convertToDamlData', () => {
    const payload = convertToDamlData('stockIssuance', stockIssuance);

    expect(payload).not.toHaveProperty('tag');
    expect(payload).toMatchObject({ id: 'si-1', date: '2025-02-03', quantity: '100' });
  });

  const records = [
    ['stakeholder', () => convertToDaml('stakeholder', stakeholder)],
    ['stockClass', () => convertToDaml('stockClass', stockClass)],
    ['stockIssuance', () => convertToDaml('stockIssuance', stockIssuance)],
    ['stockTransfer', () => convertToDaml('stockTransfer', stockTransfer)],
    ['stockPlan', () => convertToDaml('stockPlan', stockPlan)],
    ['valuation', () => convertToDaml('valuation', valuation)],
    ['financing', () => convertToDaml('financing', financing)],
  ] as const;

  it.each(records)('%s: the variant decodes through the generated OcfRecordData codec without loss', (type, build) => {
    const record = build();

    const decoded = OcfRecordData.decoder.runWithException(record);
    expect(decoded.tag).toBe(ENTITY_REGISTRY[type].recordTag);
    expect(OcfRecordData.encode(decoded)).toEqual(JSON.parse(JSON.stringify(record)));
  });

  it.each([
    ['stakeholder', () => decodeDamlEntityData('stakeholder', convertToDamlData('stakeholder', stakeholder))],
    ['stockClass', () => decodeDamlEntityData('stockClass', convertToDamlData('stockClass', stockClass))],
    ['stockIssuance', () => decodeDamlEntityData('stockIssuance', convertToDamlData('stockIssuance', stockIssuance))],
    ['valuation', () => decodeDamlEntityData('valuation', convertToDamlData('valuation', valuation))],
  ] as const)('%s: decodeDamlEntityData accepts the payload and yields its generated value', (type, decode) => {
    const record = records.find(([name]) => name === type)?.[1]();

    expect(decode()).toEqual(OcfRecordData.decoder.runWithException(record).value);
  });
});
