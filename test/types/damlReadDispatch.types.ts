/** Compile-time contracts for generated DAML read dispatch. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  convertToOcf,
  decodeDamlEntityData,
  ENTITY_TEMPLATE_ID_MAP,
  extractAndDecodeDamlEntityData,
  type DamlDataTypeFor,
} from '../../src/functions/OpenCapTable/capTable';
import type { SingleContractReadResult } from '../../src/functions/OpenCapTable/shared/singleContractRead';
import type { OcfStakeholder } from '../../src/types/native';

declare const stakeholderDamlData: DamlDataTypeFor<'stakeholder'>;
declare const stockClassDamlData: DamlDataTypeFor<'stockClass'>;
declare const unknownLedgerData: unknown;
declare const unknownCreateArgument: unknown;

const stakeholder: OcfStakeholder = convertToOcf('stakeholder', stakeholderDamlData);
const decodedStakeholder: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData = decodeDamlEntityData(
  'stakeholder',
  unknownLedgerData
);
const extractedStakeholder: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData = extractAndDecodeDamlEntityData(
  'stakeholder',
  unknownCreateArgument
);
const stakeholderTemplateId: string = ENTITY_TEMPLATE_ID_MAP.stakeholder;
declare const singleContractReadResult: SingleContractReadResult;
const validatedCreatedEventContractId: string = singleContractReadResult.createdEvent.contractId;
const validatedCreatedEventArgument: Record<string, unknown> = singleContractReadResult.createdEvent.createArgument;

void stakeholder;
void decodedStakeholder;
void extractedStakeholder;
void stakeholderTemplateId;
void validatedCreatedEventContractId;
void validatedCreatedEventArgument;

// @ts-expect-error the entity kind and generated DAML payload must remain correlated
convertToOcf('stakeholder', stockClassDamlData);

// @ts-expect-error extracted generated payload remains correlated with the entity kind
const wrongExtractedType: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData = extractAndDecodeDamlEntityData(
  'stakeholder',
  unknownCreateArgument
);
void wrongExtractedType;

// @ts-expect-error decoded generated payload remains correlated with the entity kind
const wrongDecodedType: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData = decodeDamlEntityData(
  'stakeholder',
  unknownLedgerData
);
void wrongDecodedType;

// @ts-expect-error unsupported entity kinds have no registered generated template
ENTITY_TEMPLATE_ID_MAP.planSecurityIssuance;
