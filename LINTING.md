# Linting and Formatting

This project uses ESLint and Prettier to maintain consistent code quality and formatting.

## Tools

- **ESLint**: TypeScript-aware linting with strict rules
- **Prettier**: Code formatting for consistent style
- **VS Code Integration**: Auto-fix on save

## Configuration Files

- `.eslintrc.json` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `.eslintignore` - Files to exclude from linting
- `.prettierignore` - Files to exclude from formatting
- `.vscode/settings.json` - VS Code auto-fix on save settings

## Scripts

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix

# Check formatting
npm run format

# Auto-format code
npm run format:fix

# Fix both linting and formatting
npm run fix
```

## ESLint Rules

The project enforces strict TypeScript rules including:

- **No `any` types**: Explicit typing required (`@typescript-eslint/no-explicit-any`)
- **Type imports**: Prefer `type` imports for type-only imports
- **Import ordering**: Alphabetically sorted, grouped by type
- **Unused imports**: Automatically removed
- **Async safety**: Proper handling of promises and async code
- **Nullish coalescing**: Prefer `??` over `||` for better type safety

## Prettier Configuration

- Single quotes
- 2-space indentation
- 100-character line width
- Semicolons required
- Trailing commas (ES5)
- LF line endings

## VS Code Setup

The `.vscode/settings.json` file enables:

- Format on save
- ESLint auto-fix on save
- Prettier as default formatter

## CI Integration

The `test` script runs type checking before tests, ensuring all code passes TypeScript compilation.

## Existing Issues

The codebase currently has many `any` type warnings that need to be addressed over time. These are
intentionally configured as errors to prevent new `any` types from being introduced.
