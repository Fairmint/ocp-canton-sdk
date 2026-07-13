/** Compile-time contracts for cast-free generated DAML operation builders. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type {
  OcfCreateData,
  OcfCreateDataFor,
  OcfDeleteData,
  OcfDeleteDataFor,
  OcfEditData,
  OcfEditDataFor,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfDeleteData,
  buildOcfEditData,
} from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import type { OcfFinancing, OcfIssuer, OcfStakeholder, OcfStockClass } from '../../src/types/native';

function verifyGeneratedOperationBuilders(
  stakeholder: OcfStakeholder,
  stockClass: OcfStockClass,
  financing: OcfFinancing,
  issuer: OcfIssuer
): void {
  const create: OcfCreateData = buildOcfCreateData('stakeholder', stakeholder);
  const edit: OcfEditData = buildOcfEditData('issuer', issuer);
  const deletion: OcfDeleteData = buildOcfDeleteData('stakeholder', stakeholder.id);
  const exactCreate: OcfCreateDataFor<'stakeholder'> = buildOcfCreateData('stakeholder', stakeholder);
  const exactEdit: OcfEditDataFor<'issuer'> = buildOcfEditData('issuer', issuer);
  const exactDelete: OcfDeleteDataFor<'stakeholder'> = buildOcfDeleteData('stakeholder', stakeholder.id);
  const financingCreate: OcfCreateDataFor<'financing'> = buildOcfCreateData('financing', financing);
  const financingEdit: OcfEditDataFor<'financing'> = buildOcfEditData('financing', financing);
  const financingDelete: OcfDeleteDataFor<'financing'> = buildOcfDeleteData('financing', financing.id);
  const exactCreateTag: 'OcfCreateStakeholder' = exactCreate.tag;
  const exactEditTag: 'OcfEditIssuer' = exactEdit.tag;
  const exactDeleteTag: 'OcfDeleteStakeholder' = exactDelete.tag;
  const exactCreateValue: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData = exactCreate.value;
  const exactEditValue: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData = exactEdit.value;
  const exactDeleteValue: string = exactDelete.value;
  const financingCreateTag: 'OcfCreateFinancing' = financingCreate.tag;
  const financingEditTag: 'OcfEditFinancing' = financingEdit.tag;
  const financingDeleteTag: 'OcfDeleteFinancing' = financingDelete.tag;
  const financingCreateValue: Fairmint.OpenCapTable.OCF.Financing.FinancingOcfData = financingCreate.value;
  void create;
  void edit;
  void deletion;
  void exactCreateTag;
  void exactEditTag;
  void exactDeleteTag;
  void exactCreateValue;
  void exactEditValue;
  void exactDeleteValue;
  void financingCreateTag;
  void financingEditTag;
  void financingDeleteTag;
  void financingCreateValue;

  // @ts-expect-error create builders preserve entity-kind/payload correlation
  buildOcfCreateData('stockClass', stakeholder);

  // @ts-expect-error edit builders preserve entity-kind/payload correlation
  buildOcfEditData('stakeholder', stockClass);

  // @ts-expect-error issuer is edit-only and has no generated delete variant
  buildOcfDeleteData('issuer', issuer.id);
}

void verifyGeneratedOperationBuilders;
