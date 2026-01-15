// Mock for daml.js/* packages used by @fairmint/open-captable-protocol-daml-js
//
// These are DAML standard library packages that are only available at runtime
// when connected to a Canton network. For unit tests, we mock them since we
// only need the TypeScript types, not the actual DAML runtime functionality.

export const Archive = {
  decoder: { run: () => ({}) },
  encode: () => ({}),
};

export {};
