/**
 * Compile-time contract tests for the public CapTableBatch API.
 *
 * This file is included by tsconfig.tests.json but intentionally does not match
 * Jest's test-file pattern. `npm run typecheck` is the test runner: every
 * `@ts-expect-error` must continue to describe a real compiler error.
 */

import {
  type CapTableBatch,
  type CapTableBatchOperations,
  convertToDaml,
  type OcfCreateOperation,
  type OcfIssuer,
  type OcfStakeholder,
  type OcfStockClass,
} from '../../src';

function verifyCapTableBatchContract(
  batch: CapTableBatch,
  stakeholder: OcfStakeholder,
  stockClass: OcfStockClass,
  issuer: OcfIssuer
): void {
  batch.create('stakeholder', stakeholder);
  batch.create('stockClass', stockClass);
  batch.edit('issuer', issuer);
  batch.delete('stakeholder', stakeholder.id);

  // @ts-expect-error issuer is edit-only
  batch.create('issuer', issuer);

  // @ts-expect-error issuer cannot be deleted from a cap table
  batch.delete('issuer', issuer.id);

  // @ts-expect-error the entity kind determines the payload type
  batch.create('stockClass', stakeholder);

  // @ts-expect-error the entity kind determines the edit payload type
  batch.edit('stakeholder', stockClass);

  const widenedKind = 'stakeholder' as 'stakeholder' | 'stockClass';

  // @ts-expect-error a union-valued kind does not prove which payload belongs to it
  batch.create(widenedKind, stakeholder);

  // @ts-expect-error explicit union type arguments cannot bypass kind/payload correlation
  batch.edit(widenedKind, stakeholder);

  // @ts-expect-error the converter uses the same kind/payload correlation as the batch API
  convertToDaml(widenedKind, stakeholder);

  const createOperation: OcfCreateOperation = {
    type: 'stakeholder',
    data: stakeholder,
  };
  void createOperation;

  const operations: CapTableBatchOperations = {
    creates: [
      { type: 'stakeholder', data: stakeholder },
      { type: 'stockClass', data: stockClass },
    ],
    edits: [{ type: 'issuer', data: issuer }],
    deletes: [{ type: 'stakeholder', id: stakeholder.id }],
  };
  void operations;

  // @ts-expect-error a stockClass operation cannot carry stakeholder data
  const invalidCreateOperation: OcfCreateOperation = {
    type: 'stockClass',
    data: stakeholder,
  };
  void invalidCreateOperation;
}

void verifyCapTableBatchContract;
