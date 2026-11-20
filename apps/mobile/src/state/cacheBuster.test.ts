import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { CACHE_BUSTER, CACHE_SHAPE, isPersisted } from './cacheBuster';

/** `CachedData` as text: every property, optional or not, and its type, down to the leaves. */
function cachedDataShape(): string {
  const tsconfig = fileURLToPath(new URL('../../tsconfig.json', import.meta.url));
  const file = fileURLToPath(new URL('./cacheBuster.ts', import.meta.url));
  const { config } = ts.readConfigFile(tsconfig, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, dirname(tsconfig));
  const program = ts.createProgram([file], { ...options, noEmit: true });
  const source = program.getSourceFile(file)!;
  // An unresolved import would make a type `any`, and the check meaningless.
  const errors = ts
    .getPreEmitDiagnostics(program, source)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  expect(errors).toEqual([]);

  const checker = program.getTypeChecker();
  const cachedData = checker
    .getExportsOfModule(checker.getSymbolAtLocation(source)!)
    .find((symbol) => symbol.name === 'CachedData')!;

  const inProgress = new Set<ts.Type>();
  const shapeOf = (type: ts.Type): string => {
    if (type.isUnion()) return type.types.map(shapeOf).sort().join(' | ');
    const isObject =
      type.flags & ts.TypeFlags.Object ||
      (type.isIntersection() && type.types.every((t) => t.flags & ts.TypeFlags.Object));
    if (!isObject) return checker.typeToString(type);
    if (inProgress.has(type)) return checker.typeToString(type);
    inProgress.add(type);
    try {
      if (checker.isArrayType(type))
        return `${shapeOf(checker.getTypeArguments(type as ts.TypeReference)[0]!)}[]`;
      if (checker.isTupleType(type))
        return `[${checker
          .getTypeArguments(type as ts.TypeReference)
          .map(shapeOf)
          .join(', ')}]`;
      const members = checker.getPropertiesOfType(type).map((property) => {
        const optional = property.flags & ts.SymbolFlags.Optional ? '?' : '';
        return `${property.name}${optional}: ${shapeOf(checker.getTypeOfSymbol(property))}`;
      });
      const indexes = checker
        .getIndexInfosOfType(type)
        .map((info) => `[${checker.typeToString(info.keyType)}]: ${shapeOf(info.type)}`);
      return `{ ${[...members.sort(), ...indexes.sort()].join('; ')} }`;
    } finally {
      inProgress.delete(type);
    }
  };
  return shapeOf(checker.getDeclaredTypeOfSymbol(cachedData));
}

describe('cacheBuster', () => {
  it('changes whenever the shape of cached data does', () => {
    const shape = cachedDataShape();
    expect(shape).not.toMatch(/\bany\b/);
    const fingerprint = createHash('sha256').update(shape).digest('hex').slice(0, 12);
    expect(
      CACHE_SHAPE,
      `cached data shape changed: set CACHE_SHAPE in cacheBuster.ts to '${fingerprint}'`,
    ).toBe(fingerprint);
  }, 60_000);

  it('keys the cache on the shape, not the build', () => {
    expect(CACHE_BUSTER).toMatch(new RegExp(`^${CACHE_SHAPE}\\.\\d+$`));
  });

  it('persists only the queries whose shape it checks', () => {
    expect(isPersisted(['trips'])).toBe(true);
    expect(isPersisted(['trip', 't1'])).toBe(true);
    expect(isPersisted(['bag', 'u1'])).toBe(true);
    expect(isPersisted(['somethingNew'])).toBe(false);
  });
});
