'use strict';

const assert = require('node:assert/strict');

function loadBuiltModules() {
  const originalConsoleDebug = console.debug;
  const originalConsoleLog = console.log;
  try {
    console.debug = () => undefined;
    console.log = () => undefined;
    return {
      errors: require('../dist/errors'),
      readDispatcher: require('../dist/functions/OpenCapTable/capTable/damlToOcf'),
      root: require('../dist'),
      stockConsolidationWriter: require('../dist/functions/OpenCapTable/stockConsolidation/stockConsolidationDataToDaml'),
      stockTransferWriter: require('../dist/functions/OpenCapTable/stockTransfer/createStockTransfer'),
      typeConversions: require('../dist/utils/typeConversions'),
    };
  } finally {
    console.debug = originalConsoleDebug;
    console.log = originalConsoleLog;
  }
}

const built = loadBuiltModules();
const { OcpErrorCodes, OcpValidationError } = built.errors;
const { convertToOcf } = built.readDispatcher;
const { STAKEHOLDER_RELATIONSHIP_TYPES } = built.root;
const { stockConsolidationDataToDaml } = built.stockConsolidationWriter;
const { stockTransferDataToDaml } = built.stockTransferWriter;
const { toNonEmptyStringArray } = built.typeConversions;

const expectedStakeholderRelationships = [
  'ADVISOR',
  'BOARD_MEMBER',
  'CONSULTANT',
  'EMPLOYEE',
  'EX_ADVISOR',
  'EX_CONSULTANT',
  'EX_EMPLOYEE',
  'EXECUTIVE',
  'FOUNDER',
  'INVESTOR',
  'NON_US_EMPLOYEE',
  'OFFICER',
  'OTHER',
];
assert.deepEqual(STAKEHOLDER_RELATIONSHIP_TYPES, expectedStakeholderRelationships);
assert.equal(Object.isFrozen(STAKEHOLDER_RELATIONSHIP_TYPES), true);
assert.throws(() => STAKEHOLDER_RELATIONSHIP_TYPES.push('LEGACY_RELATIONSHIP'), TypeError);

function expectValidationError(action, expectedPath, expectedCode) {
  assert.throws(action, (error) => {
    assert(error instanceof OcpValidationError);
    assert.equal(error.fieldPath, expectedPath);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

expectValidationError(
  () => toNonEmptyStringArray(['duplicate', 'duplicate'], 'items', { uniqueItems: true }),
  'items.1',
  OcpErrorCodes.INVALID_FORMAT
);

let trapCalls = 0;
const proxy = new Proxy(['secret'], {
  get(target, property, receiver) {
    trapCalls += 1;
    return Reflect.get(target, property, receiver);
  },
  ownKeys(target) {
    trapCalls += 1;
    return Reflect.ownKeys(target);
  },
});
expectValidationError(() => toNonEmptyStringArray(proxy, 'items'), 'items', OcpErrorCodes.SCHEMA_MISMATCH);
assert.equal(trapCalls, 0);

const transferDaml = {
  balance_security_id: null,
  comments: [],
  consideration_text: null,
  date: '2026-01-01T00:00:00.000Z',
  id: 'transfer-1',
  quantity: '1',
  resulting_security_ids: ['duplicate', 'duplicate'],
  security_id: 'security-1',
};
expectValidationError(
  () => convertToOcf('stockTransfer', transferDaml),
  'stockTransfer.resulting_security_ids.1',
  OcpErrorCodes.INVALID_FORMAT
);

expectValidationError(
  () =>
    stockTransferDataToDaml({
      date: '2026-01-01',
      id: 'transfer-1',
      object_type: 'TX_STOCK_TRANSFER',
      quantity: '1',
      resulting_security_ids: ['duplicate', 'duplicate'],
      security_id: 'security-1',
    }),
  'stockTransfer.resulting_security_ids.1',
  OcpErrorCodes.INVALID_FORMAT
);

expectValidationError(
  () =>
    stockConsolidationDataToDaml({
      date: '2026-01-01',
      id: 'consolidation-1',
      object_type: 'TX_STOCK_CONSOLIDATION',
      security_ids: [],
      resulting_security_id: 'result-1',
    }),
  'stockConsolidation.security_ids',
  OcpErrorCodes.OUT_OF_RANGE
);
