/** Built-declaration contracts for exact generated DAML batch operation variants. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  buildOcfCreateData,
  buildOcfDeleteData,
  buildOcfEditData,
  type OcfCreateDataFor,
  type OcfDeleteDataFor,
  type OcfEditDataFor,
  type OcfFinancing,
  type OcfIssuer,
  type OcfStakeholder,
} from '../../dist';

declare const stakeholder: OcfStakeholder;
declare const financing: OcfFinancing;
declare const issuer: OcfIssuer;

const create: OcfCreateDataFor<'stakeholder'> = buildOcfCreateData('stakeholder', stakeholder);
const edit: OcfEditDataFor<'issuer'> = buildOcfEditData('issuer', issuer);
const deletion: OcfDeleteDataFor<'stakeholder'> = buildOcfDeleteData('stakeholder', stakeholder.id);
const financingCreate: OcfCreateDataFor<'financing'> = buildOcfCreateData('financing', financing);
const financingEdit: OcfEditDataFor<'financing'> = buildOcfEditData('financing', financing);
const financingDelete: OcfDeleteDataFor<'financing'> = buildOcfDeleteData('financing', financing.id);

const createTag: 'OcfCreateStakeholder' = create.tag;
const editTag: 'OcfEditIssuer' = edit.tag;
const deleteTag: 'OcfDeleteStakeholder' = deletion.tag;
const createValue: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData = create.value;
const editValue: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData = edit.value;
const deleteValue: string = deletion.value;
const financingCreateTag: 'OcfCreateFinancing' = financingCreate.tag;
const financingEditTag: 'OcfEditFinancing' = financingEdit.tag;
const financingDeleteTag: 'OcfDeleteFinancing' = financingDelete.tag;
const financingCreateValue: Fairmint.OpenCapTable.OCF.Financing.FinancingOcfData = financingCreate.value;

void createTag;
void editTag;
void deleteTag;
void createValue;
void editValue;
void deleteValue;
void financingCreateTag;
void financingEditTag;
void financingDeleteTag;
void financingCreateValue;
