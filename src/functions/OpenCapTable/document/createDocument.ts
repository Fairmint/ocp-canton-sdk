import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfDocument, OcfObjectReference } from '../../../types';
import type { PkgDocumentOcfData } from '../../../types/daml';
import { damlEnumConstructor, type DamlEnumConstructor } from '../../../utils/damlEnums';
import { assertSafeOcfJson } from '../../../utils/ocfJsonValidation';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import { normalizeObjectType } from '../../../utils/planSecurityAliases';
import { cleanComments } from '../../../utils/typeConversions';

/**
 * The register has no constructors for the seven `TX_PLAN_SECURITY_*` aliases: they are written as the
 * `TX_EQUITY_COMPENSATION_*` object type they stand for.
 */
function objectTypeToDaml(t: OcfObjectReference['object_type']): DamlEnumConstructor<'OcfObjectType'> {
  return damlEnumConstructor('OcfObjectType', normalizeObjectType(t), 'objectReference.object_type');
}

export function documentDataToDaml(d: OcfDocument): PkgDocumentOcfData {
  assertSafeOcfJson(d, 'document');

  if (!d.id) {
    throw new OcpValidationError('document.id', 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }

  const path = typeof d.path === 'string' ? d.path : null;
  const uri = typeof d.uri === 'string' ? d.uri : null;

  const result = {
    id: d.id,
    path,
    uri,
    md5: d.md5,
    related_objects: (d.related_objects ?? []).map((r) => ({
      object_type: objectTypeToDaml(r.object_type),
      object_id: r.object_id,
    })),
    comments: cleanComments(d.comments),
  };
  parseOcfEntityInput('document', d);
  return result;
}
