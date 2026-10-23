/**
 * Every OCF to Daml converter returns its generated `<Name>OcfData`: the compiler enforces the v35 shape of each
 * record, so no converter may hand back an untyped record.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { isOcfEditableEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';

const ENTITY_ROOT = path.resolve(__dirname, '../../src/functions/OpenCapTable');

interface ConverterDeclaration {
  readonly file: string;
  readonly name: string;
  readonly returnType: string | undefined;
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.ts') ? [absolutePath] : [];
  });
}

function exportedDataToDamlConverters(): ConverterDeclaration[] {
  return sourceFiles(ENTITY_ROOT).flatMap((file) => {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const found: ConverterDeclaration[] = [];
    source.forEachChild((node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name !== undefined &&
        node.name.text.endsWith('DataToDaml') &&
        node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true
      ) {
        found.push({
          file: path.relative(ENTITY_ROOT, file),
          name: node.name.text,
          returnType: node.type?.getText(source),
        });
      }
    });
    return found;
  });
}

describe('typed OCF to Daml converters', () => {
  const converters = exportedDataToDamlConverters();

  test('finds the converter of every writable entity kind and the two plan-security aliases', () => {
    const names = new Set(converters.map(({ name }) => name));
    const writable = Object.keys(ENTITY_REGISTRY).filter(isOcfEditableEntityType);

    expect(writable).toHaveLength(49);
    for (const entityType of writable) {
      expect(names).toContain(`${entityType}DataToDaml`);
    }
    expect(names).toContain('planSecurityIssuanceDataToDaml');
    expect(names).toContain('planSecurityExerciseDataToDaml');
  });

  test.each(converters.map((converter) => [converter.name, converter] as const))(
    '%s declares its generated OcfData return type',
    (_name, converter) => {
      expect(converter.returnType).toBeDefined();
      expect(converter.returnType).toMatch(/OcfData$/);
      expect(converter.returnType).not.toMatch(/Record|unknown|any\b|object\b/);
    }
  );
});
