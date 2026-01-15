# ADR-001: Batch Cap Table Updates API

**Status**: Implemented **Date**: 2026-01-12 **Authors**: Cursor Agent **Reviewers**:
@HardlyDifficult

## Context

The OCP Canton SDK currently uses individual DAML choices for each OCF entity operation (e.g.,
`CreateStakeholder`, `EditStockClass`, `DeleteDocument`). However, the underlying DAML CapTable
contract has evolved to use a unified batch `UpdateCapTable` choice that handles all creates, edits,
and deletes in a single atomic transaction.

### Current SDK Architecture

```
src/functions/OpenCapTable/
├── stakeholder/
│   ├── addStakeholder.ts       # Uses choice: 'CreateStakeholder'
│   ├── editStakeholder.ts      # Uses choice: 'EditStakeholder'
│   └── deleteStakeholder.ts    # Uses choice: 'DeleteStakeholder'
├── stockClass/
│   ├── addStockClass.ts
│   ├── editStockClass.ts
│   └── deleteStockClass.ts
└── ... (21 entity folders, ~63 files)
```

Each function:

1. Takes entity-specific parameters
2. Converts OCF data to DAML format
3. Calls `buildCapTableCommand()` with an individual choice name
4. Returns a single command

### DAML Contract Reality

The CapTable contract (v25) exposes a unified `UpdateCapTable` choice:

```typescript
interface UpdateCapTable {
  creates: OcfCreateData[]; // Tagged union of all 48 entity types
  edits: OcfEditData[]; // Tagged union of all 48 entity types
  deletes: OcfObjectId[]; // Tagged union of all entity IDs
}
```

Where `OcfCreateData` is a discriminated union:

```typescript
type OcfCreateData =
  | { tag: 'OcfCreateStakeholder'; value: StakeholderOcfData }
  | { tag: 'OcfCreateStockClass'; value: StockClassOcfData }
  | { tag: 'OcfCreateValuation'; value: ValuationOcfData };
// ... 45 more variants
```

### Problems with Current Approach

1. **Not aligned with DAML contract**: Individual choices may be deprecated or removed
2. **No batch support**: Cannot create multiple entities atomically
3. **Maintenance burden**: 48 entity types × 3 operations = 144 separate functions
4. **27 unsupported entities**: SDK only supports 21 of 48 available entity types
5. **Inconsistent patterns**: Some entities have different function signatures

## Decision

**Redesign the SDK to use the batch `UpdateCapTable` choice with a fluent batch builder API.**

### Fluent Batch Builder API

```typescript
// New primary API
const result = await ocp.capTable
  .update({
    capTableContractId,
    featuredAppRightContractDetails,
  })
  .create('stakeholder', stakeholderData)
  .create('stockClass', stockClassData)
  .create('stockIssuance', issuanceData)
  .edit('stakeholder', updatedStakeholderData)
  .delete('document', documentId)
  .execute();

// Returns created contract IDs mapped by entity type and OCF ID
result.stakeholders['sh-123']; // ContractId
result.stockClasses['sc-456']; // ContractId
```

### Implementation

```typescript
// src/functions/OpenCapTable/capTable/CapTableBatch.ts
export class CapTableBatch {
  private creates: OcfCreateData[] = [];
  private edits: OcfEditData[] = [];
  private deletes: OcfObjectId[] = [];

  create<T extends OcfEntityType>(type: T, data: OcfDataTypeFor<T>): this {
    const damlData = convertToDaml(type, data);
    this.creates.push({ tag: `OcfCreate${pascalCase(type)}`, value: damlData });
    return this;
  }

  edit<T extends OcfEntityType>(type: T, data: OcfDataTypeFor<T>): this {
    const damlData = convertToDaml(type, data);
    this.edits.push({ tag: `OcfEdit${pascalCase(type)}`, value: damlData });
    return this;
  }

  delete<T extends OcfEntityType>(type: T, id: string): this {
    this.deletes.push({ tag: `Ocf${pascalCase(type)}Id`, value: id });
    return this;
  }

  build(): UpdateCapTableCommand {
    /* ... */
  }
  async execute(): Promise<UpdateCapTableResult> {
    /* ... */
  }
}
```

### Benefits

1. **Atomic transactions**: Multiple operations in one ledger command
2. **Type-safe**: TypeScript discriminated unions provide compile-time checks
3. **Extensible**: Adding new entity types requires only adding to the union
4. **DRY**: Single `convertToDaml()` dispatch instead of 48 converter files
5. **Matches DAML**: Direct mapping to the `UpdateCapTable` choice

### Data Conversion Strategy

Instead of 48 separate `*DataToDaml.ts` files, use a centralized converter:

```typescript
// src/utils/ocfToDaml.ts
export function convertToDaml<T extends OcfEntityType>(
  type: T,
  data: OcfDataTypeFor<T>
): DamlDataTypeFor<T> {
  switch (type) {
    case 'stakeholder':
      return stakeholderToDaml(data as OcfStakeholder);
    case 'stockClass':
      return stockClassToDaml(data as OcfStockClass);
    // ... all 48 types
  }
}
```

The individual converter functions (`stakeholderToDaml`, `stockClassToDaml`, etc.) can be extracted
from existing code.

### Read Operations

The batch approach applies to writes (create/edit/delete). Read operations (`get*AsOcf`) remain
unchanged as they query individual contracts.

## File Structure

```
src/
├── functions/OpenCapTable/
│   ├── capTable/
│   │   ├── CapTableBatch.ts        # New batch builder
│   │   ├── buildUpdateCommand.ts   # Builds UpdateCapTable choice
│   │   └── types.ts                # Batch-related types
│   ├── converters/                  # Extracted from existing code
│   │   ├── stakeholderToDaml.ts
│   │   ├── stockClassToDaml.ts
│   │   └── ...
│   └── readers/                     # get*AsOcf functions (unchanged)
│       ├── getStakeholderAsOcf.ts
│       └── ...
├── types/
│   ├── ocfEntities.ts               # All 48 OCF entity types
│   └── native.ts                    # Native TypeScript interfaces
└── utils/
    ├── ocfToDaml.ts                 # Centralized conversion
    └── ocfMetadata.ts               # Entity type registry
```

## Migration Path

### Phase 1: Implement Batch API

1. Implement `CapTableBatch` class with fluent builder pattern
2. Add centralized converters extracted from existing code
3. Add type definitions for batch operations
4. Add unit tests for batch builder

### Phase 2: Add Missing Entity Types

1. Add 27 new entity types to converters
2. Add type definitions for new entities
3. Update `ocfMetadata.ts` registry

### Phase 3: Integration & Documentation

1. Add integration tests for batch operations
2. Update `OcpClient` to expose batch API
3. Update documentation with examples
4. Remove old individual create/edit/delete functions

## Consequences

### Positive

- Atomic multi-entity transactions
- 75% reduction in boilerplate code
- Full coverage of all 48 entity types
- Better alignment with DAML contract design
- Easier to add new entity types in the future

### Negative

- Breaking change for existing consumers
- Learning curve for new batch API
- Initial implementation effort (~2-3 days)

### Risks

- Individual choices may still work in current DAML version
- Need to verify `UpdateCapTable` choice is deployed and working

## Open Questions

1. Should we support mixing operations across multiple cap tables in one call?
2. How should we handle partial failures within a batch?
3. What's the maximum batch size supported by the ledger?

## References

- [DAML CapTable Contract](https://www.npmjs.com/package/@fairmint/open-captable-protocol-daml-js)
- [OCF Specification](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF)
- [Milestone 2 Task](../tasks/2025/12/2025.12.17-milestone-2-ocp-sdk-implementation.md)
