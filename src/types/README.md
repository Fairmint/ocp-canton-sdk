# OCF type documentation policy

This directory contains the public TypeScript types that mirror Open Cap Format data structures.
Keep their comments aligned with the OCF version and generated DAML package pinned by this
repository; do not copy paths or version numbers from an older package line.

## Sources of truth

1. The OCF submodule pinned at [`libs/Open-Cap-Format-OCF`](../../libs/Open-Cap-Format-OCF) contains
   the canonical JSON schemas for the package line used by this checkout.
2. The exact `@fairmint/open-captable-protocol-daml-js` version in
   `devDependencies` in [`package.json`](../../package.json) defines the generated DAML boundary
   used by this checkout. Its `peerDependencies` range defines supported consumer compatibility.
3. The types in this directory expose the curated SDK representation and must not invent semantics
   absent from the canonical schema.

When schema and generated bindings differ, document the implementation constraint explicitly and
link the relevant schema or source code. Keep generated DAML types behind the package boundary
defined by [`src/index.ts`](../index.ts).

After changing public types or comments, run:

```bash
npm run typecheck
npm run test:declarations
```

See the public [architecture guide](https://github.com/Fairmint/ocp-canton-sdk/wiki/Architecture)
for source-of-truth boundaries.
