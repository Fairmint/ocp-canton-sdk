/** Built-declaration contracts for generated DAML read dispatch. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  convertToOcf,
  decodeDamlEntityData,
  ENTITY_TEMPLATE_ID_MAP,
  type DamlDataTypeFor,
  type OcfStakeholder,
} from '../../dist';

declare const stakeholderDamlData: DamlDataTypeFor<'stakeholder'>;
declare const stockClassDamlData: DamlDataTypeFor<'stockClass'>;
declare const unknownLedgerData: unknown;

const stakeholder: OcfStakeholder = convertToOcf('stakeholder', stakeholderDamlData);
const decodedStakeholder: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData = decodeDamlEntityData(
  'stakeholder',
  unknownLedgerData
);
const stakeholderTemplateId: string = ENTITY_TEMPLATE_ID_MAP.stakeholder;

void stakeholder;
void decodedStakeholder;
void stakeholderTemplateId;

// @ts-expect-error the entity kind and generated DAML payload must remain correlated
convertToOcf('stakeholder', stockClassDamlData);

// @ts-expect-error unsupported entity kinds have no registered generated template
ENTITY_TEMPLATE_ID_MAP.planSecurityIssuance;
