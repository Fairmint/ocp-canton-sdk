# Contributing to OCP Canton SDK

## Code Style Guide

This document outlines the coding patterns and conventions used in this project to ensure
consistency and maintainability.

### TypeScript Standards

#### Strict Typing

- **Never use `any` or `unknown`** without proper justification
- Always specify explicit types for function parameters and return values
- Prefer type inference for local variables where the type is obvious
- Use proper DAML-generated types from `@fairmint/open-captable-protocol-daml-js`

```typescript
// ❌ Bad
function process(data: any): any {
  return data;
}

// ✅ Good
function process(data: OcfStockCancellationTxData): ProcessedData {
  return { ...data, processed: true };
}
```

#### Type Utilities

Use the type conversion utilities from `src/utils/typeConversions.ts`:

- `numberToString(value)` - Convert number or string to string for DAML numeric fields
- `optionalString(value)` - Convert empty strings or undefined to null
- `cleanComments(comments)` - Filter and clean comments arrays
- `dateStringToDAMLTime(date)` - Convert date strings to DAML time format
- `monetaryToDaml(monetary)` - Convert monetary objects to DAML format

### Create Function Pattern

All "create" functions should follow this consistent pattern:

```typescript
export function buildCreate{Entity}Command(
  params: Create{Entity}Params
): CommandWithDisclosedContracts {
  const { {entity}Data: d } = params;

  // Validation (fail fast)
  if (!d.id) throw new Error('{entity}.id is required');

  const choiceArguments: Fairmint.OpenCapTable.Issuer.Create{Entity} = {
    {entity}_data: {
      // List all fields explicitly (DO NOT use spread operator)
      id: d.id,
      security_id: d.security_id,
      date: dateStringToDAMLTime(d.date),
      quantity: numberToString(d.quantity),
      optional_field: optionalString(d.optional_field),
      comments: cleanComments(d.comments),
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'Create{Entity}',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [params.featuredAppRightContractDetails];

  return { command, disclosedContracts };
}
```

#### Key Principles

1. **List all fields explicitly** - DO NOT use spread operator (`...d`)
2. **Use type-safe utilities** instead of inline conversions
3. **Inline single-use functions** - avoid helper functions that are only called once
4. **Validate early** - throw errors at the start of the function
5. **Keep it flat** - avoid unnecessary nesting or intermediate variables

### Examples

#### ✅ Good: Explicit Field Listing with Transformations

```typescript
const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockCancellation = {
  cancellation_data: {
    id: d.id,
    object_type: d.object_type,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    quantity: numberToString(d.quantity),
    balance_security_id: d.balance_security_id ?? null,
    comments: cleanComments(d.comments),
  },
};
```

#### ❌ Bad: Using Spread Operator

```typescript
// Don't do this - it may include extra fields or wrong types
const choiceArguments = {
  cancellation_data: {
    ...d, // ❌ Spread is not allowed
    date: dateStringToDAMLTime(d.date),
  },
};
```

#### ❌ Bad: Unnecessary Helper Function

```typescript
// Don't do this if it's only used once
function cancellationDataToDaml(d: CancellationData) {
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    // ... many fields manually listed
  };
}

const choiceArguments = {
  cancellation_data: cancellationDataToDaml(d),
};
```

#### ❌ Bad: Manual Type Conversions

```typescript
// Don't do this
quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
optional_text: d.optional_text === '' ? null : (d.optional_text ?? null),

// Use utilities instead
quantity: numberToString(d.quantity),
optional_text: optionalString(d.optional_text),
```

### Null vs Undefined

- **Use `null`** for DAML optional fields (DAML doesn't have undefined)
- **Use `undefined`** for TypeScript optional parameters
- **Use `??` (nullish coalescing)** instead of `||` for default values

```typescript
// ✅ Good
const value = d.optional_field ?? null;

// ❌ Bad - treats 0, false, '' as falsy
const value = d.optional_field || null;
```

### Array Handling

```typescript
// ✅ Good - explicit handling
comments: cleanComments(d.comments),
items: (d.items || []).map(transform),

// ❌ Bad - implicit coercion
comments: d.comments || [],
```

### Naming Conventions

- **Functions**: `camelCase`, descriptive verb phrases (`buildCreateStockCommand`)
- **Types/Interfaces**: `PascalCase` (`CreateStockParams`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants, `camelCase` for readonly maps
- **Parameters**: Single letter `d` for data within transformation functions
- **Destructuring**: Extract with meaningful aliases (`const { cancellationData: d } = params`)

### Import Organization

Group imports by category with blank lines between:

```typescript
// 1. External dependencies
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

// 2. Internal utilities
import {
  dateStringToDAMLTime,
  monetaryToDaml,
  cleanComments,
  numberToString,
  optionalString,
} from '../../utils/typeConversions';

// 3. Type imports
import type { OcfStockIssuanceData, CommandWithDisclosedContracts } from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
```

### Error Messages

- Be specific about what's missing: `'stockIssuance.id is required'`
- Include context in error messages: `Unknown stock issuance type: ${t}`
- Fail fast - validate at the start of functions

### Comments

- Avoid obvious comments - code should be self-documenting
- Use comments for:
  - Complex business logic
  - Non-obvious workarounds
  - Explaining "why" not "what"
- JSDoc for public APIs only

```typescript
// ❌ Bad - obvious
// Convert date to DAML time
const date = dateStringToDAMLTime(d.date);

// ✅ Good - explains why
// Filter out placeholder ranges (0,0) that indicate no share numbers
.filter((range) => !(range.starting_share_number === '0' && range.ending_share_number === '0'))
```

### Testing Patterns

- Test files should be co-located or in `test/` directory
- Use descriptive test names: `'should throw error when id is missing'`
- Follow Arrange-Act-Assert pattern
- Mock external dependencies
- Avoid testing implementation details

### Pre-PR Checklist

**All of the following checks must pass before opening a PR:**

```bash
npm run typecheck   # TypeScript type checking (REQUIRED)
npm run lint        # Check for linting errors
npm run lint:fix    # Auto-fix linting errors
npm run format      # Check formatting
npm run format:fix  # Auto-format code
npm run fix         # Fix both linting and formatting
npm test           # Run all tests
```

⚠️ **Important:** Always run `npm run typecheck` before opening a PR. This catches type errors that
the IDE may not show and ensures compatibility with all TypeScript configurations.

The CI pipeline will fail if any of these checks do not pass.

### Git Commit Messages

- Use conventional commits format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- Keep first line under 72 characters
- Add detail in body if needed

Examples:

```
feat(stock-cancellation): add support for optional comments
fix(type-conversions): handle empty strings in optionalString
refactor(create-commands): use spread operator for cleaner code
```

## Architecture

### File Organization

```
src/
├── functions/           # Grouped by entity type
│   ├── stockCancellation/
│   │   ├── createStockCancellation.ts
│   │   └── getStockCancellation.ts
│   └── ...
├── types/              # Shared TypeScript types
├── utils/              # Shared utilities
│   └── typeConversions.ts
└── OcpClient.ts        # Main client
```

### Dependencies

- **Minimize dependencies** on external packages
- Use exact versions for critical dependencies
- Document why non-obvious dependencies are needed

## Questions?

If you're unsure about a pattern or have suggestions for improvements, open an issue for discussion.
