/**
 * Book helpers for integration tests.
 *
 * A test book is a cap table made the production way (factory, transfer agent acceptance, issuer creation) with a
 * `RegisterWriter` bound to it: every write goes through `CapTable_Apply` / `CapTable_Restate` as the transfer agent,
 * and every read through `OpenCapTable.<entity>.get` or `readRegister`.
 */

import type { OcpClient } from '../../../src/OcpClient';
import type {
  OcfReadableDataForObjectType,
  OcfReadableObjectType,
} from '../../../src/functions/OpenCapTable/capTable/entityTypes';
import type { RegisterIndex } from '../../../src/register/registerIndex';
import type { RegisterWriteOptions, RegisterWriter, RegisterWriterOptions } from '../../../src/register/writer';
import type { ContractResult } from '../../../src/types/common';
import type { OcfIssuer } from '../../../src/types/native';
import type {
  ApplyOperation,
  RegisterContext,
  RegisterRecordRef,
  RegisterWriteSummary,
  RestateOperation,
} from '../../../src/types/register';
import { createCapTable } from '../setup/contractDeployment';
import type { IntegrationTestContext } from '../setup/integrationTestHarness';
import { createTestIssuerData } from './setupTestData';

/** A cap table of the run and the writer that is the only way its book is written. */
export interface TestBook {
  ctx: IntegrationTestContext;
  /** The book's `Context`: its cap table ID and the three parties */
  context: RegisterContext;
  /** The issuer record the cap table was created with */
  issuerData: OcfIssuer;
  /** The `CapTable` anchor's contract ID */
  capTableContractId: string;
  /** The `Issuer` record's contract ID */
  issuerContractId: string;
  /** The book's writer, submitting as the transfer agent; it keeps its key index current */
  writer: RegisterWriter;
}

/**
 * Create a cap table through the three-step setup and read its book. The book starts with the issuer record, the
 * anchor and the 256 initial ID shards.
 *
 * @param ctx - The harness context
 * @param issuerOverrides - Fields of the issuer record the cap table starts with
 * @param writerOptions - How the book's writer sizes its transactions
 */
export async function setupTestBook(
  ctx: IntegrationTestContext,
  issuerOverrides: Parameters<typeof createTestIssuerData>[0] = {},
  writerOptions: Partial<Pick<RegisterWriterOptions, 'sizing'>> = {}
): Promise<TestBook> {
  const issuerData = createTestIssuerData(issuerOverrides);
  const created = await createCapTable(ctx.ocp, {
    issuerParty: ctx.issuerParty,
    transferAgentParty: ctx.transferAgentParty,
    issuerData,
  });
  const context: RegisterContext = {
    cap_table_id: created.capTableId,
    issuer: ctx.issuerParty,
    system_operator: ctx.systemOperatorParty,
    transfer_agent: ctx.transferAgentParty,
  };

  const index = await readBook(ctx.ocp, context);
  const writer = ctx.ocp.OpenCapTable.register.writer({
    context,
    transferAgent: ctx.transferAgentParty,
    index,
    userId: ctx.userId,
    ...writerOptions,
  });

  return {
    ctx,
    context,
    issuerData,
    capTableContractId: created.capTableContractId,
    issuerContractId: created.issuerContractId,
    writer,
  };
}

/**
 * Read one book from the active contract set as its transfer agent.
 *
 * @throws Error when no contract of the book is visible
 */
export async function readBook(
  ocp: OcpClient,
  context: RegisterContext,
  retainPayloads = true
): Promise<RegisterIndex> {
  const snapshot = await ocp.OpenCapTable.register.read({
    readAs: context.transfer_agent,
    capTableId: context.cap_table_id,
    retainPayloads,
  });
  const book = snapshot.books.find((candidate) => candidate.context.cap_table_id === context.cap_table_id);
  if (book === undefined) {
    throw new Error(`No book of cap table ${context.cap_table_id} in the active contract set`);
  }
  return book;
}

/** Read the book of a test book afresh, from the active contract set (not the writer's index). */
export async function readTestBook(book: TestBook, retainPayloads = true): Promise<RegisterIndex> {
  return readBook(book.ctx.ocp, book.context, retainPayloads);
}

/** The records a write committed, by object ID, across all of its transactions. */
export function committedRecords(summary: RegisterWriteSummary): Map<string, RegisterRecordRef> {
  const records = new Map<string, RegisterRecordRef>();
  for (const batch of summary.batches) {
    for (const [objectId, ref] of batch.result.records) records.set(objectId, ref);
  }
  return records;
}

/**
 * Write `CapTable_Apply` operations as the transfer agent, with the SDK's off-ledger checks on (as production writes
 * them). Returns the records created, by object ID.
 */
export async function applyOperations(
  book: TestBook,
  operations: readonly ApplyOperation[],
  options?: RegisterWriteOptions
): Promise<Map<string, RegisterRecordRef>> {
  return committedRecords(await book.writer.apply(operations, options));
}

/** Write one `CapTable_Restate` as the transfer agent. Returns the records it created, by object ID. */
export async function restateOperations(
  book: TestBook,
  operations: readonly RestateOperation[],
  options?: RegisterWriteOptions
): Promise<Map<string, RegisterRecordRef>> {
  return committedRecords(await book.writer.restate(operations, options));
}

/**
 * The contract ID of a record the writer's index holds.
 *
 * @throws Error when the book has no record with this object ID
 */
export function recordContractId(book: TestBook, objectId: string): string {
  const record = book.writer.index.record(objectId);
  if (record === null) {
    throw new Error(`The book has no record ${objectId}`);
  }
  return record.contractId;
}

/**
 * Read a record back as OCF through `OpenCapTable.getByObjectType`, as the transfer agent.
 *
 * @param objectType - The record's OCF `object_type`
 * @param objectId - The record's OCF `id`
 */
export async function readRecordAsOcf<T extends OcfReadableObjectType>(
  book: TestBook,
  objectType: T,
  objectId: string
): Promise<ContractResult<OcfReadableDataForObjectType<T>>> {
  return book.ctx.ocp.OpenCapTable.getByObjectType({
    objectType,
    contractId: recordContractId(book, objectId),
    readAs: [book.context.transfer_agent],
  });
}
