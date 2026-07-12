export const ENVIRONMENT_CONFIG_STRING_KEYS = Object.freeze([
  'environment',
  'ledgerApiUrl',
  'validatorApiUrl',
  'scanApiUrl',
  'authMode',
  'authUrl',
  'clientId',
  'clientSecret',
  'sharedSecret',
  'provider',
  'partyId',
  'party',
  'userId',
  'audience',
  'scope',
] as const);

export const ENVIRONMENT_CONFIG_KEYS = Object.freeze([
  ...ENVIRONMENT_CONFIG_STRING_KEYS,
  'managedParties',
  'debug',
] as const);
