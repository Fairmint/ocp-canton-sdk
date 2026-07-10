/** Built-declaration contracts for exact generated DAML batch operation variants. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type {
  OcfCreateDataFor,
  OcfDeleteDataFor,
  OcfEditDataFor,
} from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfDeleteData,
  buildOcfEditData,
} from '../../dist/functions/OpenCapTable/capTable/generatedBatchOperations';
import type { OcfIssuer, OcfStakeholder } from '../../dist/types/native';

declare const stakeholder: OcfStakeholder;
declare const issuer: OcfIssuer;

const create: OcfCreateDataFor<'stakeholder'> = buildOcfCreateData('stakeholder', stakeholder);
const edit: OcfEditDataFor<'issuer'> = buildOcfEditData('issuer', issuer);
const deletion: OcfDeleteDataFor<'stakeholder'> = buildOcfDeleteData('stakeholder', stakeholder.id);

const createTag: 'OcfCreateStakeholder' = create.tag;
const editTag: 'OcfEditIssuer' = edit.tag;
const deleteTag: 'OcfDeleteStakeholder' = deletion.tag;
const createValue: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData = create.value;
const editValue: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData = edit.value;
const deleteValue: string = deletion.value;

void createTag;
void editTag;
void deleteTag;
void createValue;
void editValue;
void deleteValue;
