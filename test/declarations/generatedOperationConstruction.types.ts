/** Built-declaration contracts for exact generated DAML batch operation variants. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  buildOcfCreateData,
  buildOcfDeleteData,
  buildOcfEditData,
  type OcfCreateDataFor,
  type OcfDeleteDataFor,
  type OcfEditDataFor,
  type OcfIssuer,
  type OcfStakeholder,
} from '../../dist';

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
