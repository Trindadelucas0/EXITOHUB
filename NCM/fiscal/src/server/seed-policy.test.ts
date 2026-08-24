import { describe, expect, it } from "vitest";
import {
  classifyRuleSync,
  seedDeletionPlan,
  shouldWipeCadastro,
} from "./seed-policy";

describe("seed seguro", () => {
  it("sem flag não apaga cadastro, usuários nem sessões", () => {
    expect(shouldWipeCadastro({})).toBe(false);
    expect(seedDeletionPlan(false)).toEqual({
      products: false,
      batches: false,
      links: false,
      rules: false,
      users: false,
      sessions: false,
      company: false,
    });
  });

  it("SEED_RESET_CADASTRO=1 só apaga lotes, produtos e vínculos", () => {
    expect(shouldWipeCadastro({ SEED_RESET_CADASTRO: "1" })).toBe(true);
    const plan = seedDeletionPlan(true);
    expect(plan.products).toBe(true);
    expect(plan.batches).toBe(true);
    expect(plan.links).toBe(true);
    expect(plan.users).toBe(false);
    expect(plan.sessions).toBe(false);
    expect(plan.company).toBe(false);
    expect(plan.rules).toBe(false);
  });

  it("classifica regras para atualizar sem perder vínculo", () => {
    const result = classifyRuleSync(
      [
        { ncm: "32091010", situacaoCodigo: "ST_INTERNO" },
        { ncm: "01012100", situacaoCodigo: "GERAL" },
      ],
      [
        { id: "keep", ncm: "32091010", situacaoCodigo: "ST_INTERNO", linked: true },
        { id: "gone", ncm: "99999999", situacaoCodigo: "GERAL", linked: false },
        { id: "orphan", ncm: "88888888", situacaoCodigo: "GERAL", linked: true },
      ],
    );
    expect(result.toUpdate.map((item) => item.id)).toEqual(["keep"]);
    expect(result.toInsert).toEqual([{ ncm: "01012100", situacaoCodigo: "GERAL" }]);
    expect(result.toDelete.map((item) => item.id)).toEqual(["gone"]);
    expect(result.toKeepOrphan.map((item) => item.id)).toEqual(["orphan"]);
  });
});
