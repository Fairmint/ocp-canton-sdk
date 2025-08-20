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

function isCreatedTreeEventWrapper(event: unknown): event is CreatedTreeEventWrapper {
	if (!event || typeof event !== 'object') return false;
	const e = event as { CreatedTreeEvent?: { value?: unknown } };
	return !!e.CreatedTreeEvent && typeof e.CreatedTreeEvent === 'object' && 'value' in e.CreatedTreeEvent;
}

export function findCreatedEventByTemplateId(
	response: SubmitAndWaitForTransactionTreeResponse,
	expectedTemplateId: string
): CreatedTreeEventWrapper | undefined {
	const eventsById = (response.transactionTree?.eventsById ?? {}) as Record<string, unknown>;
	for (const event of Object.values(eventsById)) {
		if (isCreatedTreeEventWrapper(event)) {
			const created = event.CreatedTreeEvent.value;
			if (created?.templateId === expectedTemplateId) {
				return event;
			}
		}
	}
	return undefined;
} 