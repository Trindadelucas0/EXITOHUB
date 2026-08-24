export type SeedDeletionPlan = {
  products: boolean;
  batches: boolean;
  links: boolean;
  rules: boolean;
  users: boolean;
  sessions: boolean;
  company: boolean;
};

export function shouldWipeCadastro(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.SEED_RESET_CADASTRO === "1";
}

export function seedDeletionPlan(wipeCadastro: boolean): SeedDeletionPlan {
  if (wipeCadastro) {
    return {
      products: true,
      batches: true,
      links: true,
      rules: false,
      users: false,
      sessions: false,
      company: false,
    };
  }
  return {
    products: false,
    batches: false,
    links: false,
    rules: false,
    users: false,
    sessions: false,
    company: false,
  };
}

export function ruleSyncKey(ncm: string, situacaoCodigo: string): string {
  return `${ncm}::${situacaoCodigo}`;
}

export type ExistingRule = {
  id: string;
  ncm: string;
  situacaoCodigo: string;
  linked: boolean;
};

export type IncomingRuleKey = {
  ncm: string;
  situacaoCodigo: string;
};

export function classifyRuleSync(incoming: IncomingRuleKey[], existing: ExistingRule[]) {
  const incomingKeys = new Set(incoming.map((item) => ruleSyncKey(item.ncm, item.situacaoCodigo)));
  const existingByKey = new Map(existing.map((item) => [ruleSyncKey(item.ncm, item.situacaoCodigo), item]));
  const toInsert = incoming.filter((item) => !existingByKey.has(ruleSyncKey(item.ncm, item.situacaoCodigo)));
  const toUpdate = incoming
    .map((item) => existingByKey.get(ruleSyncKey(item.ncm, item.situacaoCodigo)))
    .filter((item): item is ExistingRule => Boolean(item));
  const toDelete = existing.filter(
    (item) => !incomingKeys.has(ruleSyncKey(item.ncm, item.situacaoCodigo)) && !item.linked,
  );
  const toKeepOrphan = existing.filter(
    (item) => !incomingKeys.has(ruleSyncKey(item.ncm, item.situacaoCodigo)) && item.linked,
  );
  return { toInsert, toUpdate, toDelete, toKeepOrphan };
}
