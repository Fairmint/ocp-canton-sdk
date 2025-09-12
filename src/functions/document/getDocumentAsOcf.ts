import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlDocumentDataToNative } from '../../utils/typeConversions';
import { OcfDocumentData } from '../../types/native';

export interface GetDocumentAsOcfParams {
  contractId: string;
}

export interface GetDocumentAsOcfResult {
  document: (OcfDocumentData & { object_type: 'DOCUMENT'; id?: string });
  contractId: string;
}

export async function getDocumentAsOcf(
  client: LedgerJsonApiClient,
  params: GetDocumentAsOcfParams
): Promise<GetDocumentAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('No createArgument found for contract');
  }

  const createArgument = eventsResponse.created.createdEvent.createArgument;

  function hasDocumentData(arg: unknown): arg is { document_data: Fairmint.OpenCapTable.Document.OcfDocument } {
    return typeof arg === 'object' && arg !== null && 'document_data' in (arg as any) && typeof (arg as any).document_data === 'object';
  }

  if (!hasDocumentData(createArgument)) {
    throw new Error('Unexpected createArgument shape for Document');
  }

  const native = damlDocumentDataToNative(createArgument.document_data);
  const { ocf_id, ...rest } = native as any;
  const ocf = {
    object_type: 'DOCUMENT' as const,
    id: ocf_id,
    ...rest
  };
  return { document: ocf, contractId: params.contractId };
}


