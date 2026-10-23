/**
 * The OpenCapTable-v35 register's templates, by module and entity: the 51 OCF record templates of `ENTITY_REGISTRY`,
 * the `CapTable` anchor and the three state templates (`StockSecurity`, `StockClassEpoch`, `OcfIdShard`).
 *
 * A reader recognises a contract by its package name and its template's module and entity, in either template-ID form
 * the Ledger API uses (`#OpenCapTable-v35:Module:Entity` or `<package-id>:Module:Entity`): an upgrade of the package
 * keeps the name and changes the ID.
 */

import { Fairmint, OCP_INTERFACES, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { ENTITY_REGISTRY } from '../functions/OpenCapTable/capTable/batchTypes';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import type { OcfObjectType } from '../types/native';

/** The register package's name, which every genuine register contract carries. */
export const OPEN_CAP_TABLE_PACKAGE_NAME = 'OpenCapTable-v35';

/** The package ID of the bundled `OpenCapTable-v35` build. */
export const BUNDLED_OPEN_CAP_TABLE_PACKAGE_ID = packageRefOf(
  Fairmint.OpenCapTable.CapTable.CapTable.templateIdWithPackageId
);

/** The `RegisterContractView.kind` of each register state template. */
export type RegisterContractViewKind = 'CAP_TABLE' | 'STOCK_SECURITY' | 'STOCK_CLASS_EPOCH' | 'OCF_ID_SHARD';

/** A register template, as a reader recognises it. */
export type RegisterTemplate =
  | {
      readonly kind: 'record';
      readonly moduleEntity: string;
      readonly entityType: OcfEntityType;
      readonly objectType: OcfObjectType;
    }
  | { readonly kind: 'anchor'; readonly moduleEntity: string; readonly viewKind: 'CAP_TABLE' }
  | { readonly kind: 'state'; readonly moduleEntity: string; readonly viewKind: 'STOCK_SECURITY' }
  | { readonly kind: 'epoch'; readonly moduleEntity: string; readonly viewKind: 'STOCK_CLASS_EPOCH' }
  | { readonly kind: 'shard'; readonly moduleEntity: string; readonly viewKind: 'OCF_ID_SHARD' };

/** The `Module:Entity` of an interface or template ID, after its first `:`. */
export function moduleEntityOf(templateId: string): string | null {
  const colon = templateId.indexOf(':');
  if (colon <= 0 || colon === templateId.length - 1) return null;
  return templateId.slice(colon + 1);
}

/** The package reference of an interface or template ID, before its first `:` (`#name` or a package ID). */
export function packageRefOf(templateId: string): string {
  const colon = templateId.indexOf(':');
  return colon < 0 ? templateId : templateId.slice(0, colon);
}

function requireModuleEntity(templateId: string): string {
  const moduleEntity = moduleEntityOf(templateId);
  if (moduleEntity === null) throw new Error(`Generated template ID without a module and entity: ${templateId}`);
  return moduleEntity;
}

function buildRegisterTemplates(): ReadonlyMap<string, RegisterTemplate> {
  const templates = new Map<string, RegisterTemplate>();
  const add = (template: RegisterTemplate): void => {
    templates.set(template.moduleEntity, template);
  };
  for (const [entityType, entry] of Object.entries(ENTITY_REGISTRY) as Array<
    [OcfEntityType, (typeof ENTITY_REGISTRY)[OcfEntityType]]
  >) {
    add({
      kind: 'record',
      moduleEntity: requireModuleEntity(entry.templateId),
      entityType,
      objectType: entry.objectType,
    });
  }
  add({ kind: 'anchor', moduleEntity: requireModuleEntity(OCP_TEMPLATES.capTable), viewKind: 'CAP_TABLE' });
  add({ kind: 'state', moduleEntity: requireModuleEntity(OCP_TEMPLATES.stockSecurity), viewKind: 'STOCK_SECURITY' });
  add({
    kind: 'epoch',
    moduleEntity: requireModuleEntity(OCP_TEMPLATES.stockClassEpoch),
    viewKind: 'STOCK_CLASS_EPOCH',
  });
  add({ kind: 'shard', moduleEntity: requireModuleEntity(OCP_TEMPLATES.ocfIdShard), viewKind: 'OCF_ID_SHARD' });
  return templates;
}

/** The register's 55 templates by `Module:Entity`. */
export const REGISTER_TEMPLATES: ReadonlyMap<string, RegisterTemplate> = buildRegisterTemplates();

/** The `Module:Entity` of the `OcfObject` interface, which every OCF record template implements. */
export const OCF_OBJECT_INTERFACE = requireModuleEntity(OCP_INTERFACES.ocfObject);

/** The `Module:Entity` of the `RegisterContract` interface, which the anchor and the state templates implement. */
export const REGISTER_CONTRACT_INTERFACE = requireModuleEntity(OCP_INTERFACES.registerContract);
