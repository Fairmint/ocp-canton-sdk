// Minimal mock for validator API that reads fixtures

export function lookupFeaturedAppRight({ partyId }: { partyId: string }) {
  // partyId is a simplified alias in tests like 'fairmint'
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  const fixturePath = path.join(
    __dirname,
    '..',
    'fixtures',
    'validatorApi',
    'v0',
    'scan-proxy',
    'featured-apps',
    `${partyId}.json`
  );
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing validator fixture at ${fixturePath}`);
  }
  const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  return Promise.resolve(data);
}

export function getAmuletRules() {
  // Not needed for current tests; keep a stub
  return Promise.resolve({ amulet_rules: { contract: {}, dso: '' } });
}

export function getPartyId() {
  return 'fairmint';
}


