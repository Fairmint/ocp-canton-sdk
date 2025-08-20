import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface CreatedTreeEventValue {
	contractId: string;
	templateId: string;
	contractKey?: unknown;
	createArgument?: unknown;
	createdEventBlob?: string;
	witnessParties?: string[];
	signatories?: string[];
	observers?: string[];
	createdAt?: string;
	packageName?: string;
}

export interface CreatedTreeEventWrapper {
	CreatedTreeEvent: {
		value: CreatedTreeEventValue;
	};
}

export function findCreatedEventByTemplateId(
	response: SubmitAndWaitForTransactionTreeResponse,
	expectedTemplateId: string
): CreatedTreeEventWrapper | undefined {
	const eventsById = (response as any)?.transactionTree?.eventsById ?? {};
	for (const event of Object.values(eventsById)) {
		if (event && (event as any).CreatedTreeEvent) {
			const created = (event as any).CreatedTreeEvent.value as CreatedTreeEventValue;
			if (created?.templateId === expectedTemplateId) {
				return event as CreatedTreeEventWrapper;
			}
		}
	}
	return undefined;
} 