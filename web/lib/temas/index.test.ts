import { describe, expect, it } from "vitest";
import { resolverTema, sortearLata, TEMAS, TEMA_PADRAO } from "./index";

describe("resolverTema", () => {
  it("acha o tema pelo nome", () => {
    expect(resolverTema("oleo").nome).toBe("oleo");
    expect(resolverTema("redbull").nome).toBe("redbull");
  });

  it("cai no padrao quando o nome nao existe", () => {
    // Erro de digitacao na URL no dia do evento nao pode deixar a tela preta.
    expect(resolverTema("redbul")).toBe(TEMA_PADRAO);
    expect(resolverTema("")).toBe(TEMA_PADRAO);
  });

  it("cai no padrao sem nome nenhum", () => {
    expect(resolverTema()).toBe(TEMA_PADRAO);
    expect(resolverTema(null)).toBe(TEMA_PADRAO);
  });

  it("usa redbull como padrao", () => {
    expect(TEMA_PADRAO.nome).toBe("redbull");
  });
});

describe("sortearLata", () => {
  const doze = {
    tipo: "sprite" as const,
    imagens: Array.from({ length: 12 }, (_, i) => `lata-${i}.png`),
    largura: 1,
    altura: 2,
  };

  it("devolve uma das imagens listadas", () => {
    expect(sortearLata(doze, () => 0)).toBe("lata-0.png");
    expect(sortearLata(doze, () => 0.5)).toBe("lata-6.png");
  });

  it("nao estoura quando o sorteio devolve 1", () => {
    // Math.random() nunca devolve 1, mas um sorteio injetado pode.
    expect(sortearLata(doze, () => 1)).toBe("lata-11.png");
  });

  it("funciona com uma imagem so", () => {
    const uma = {
      tipo: "sprite" as const,
      imagens: ["x.png"],
      largura: 1,
      altura: 2,
    };
    expect(sortearLata(uma, () => 0.99)).toBe("x.png");
  });

  it("devolve null para recipiente que nao e sprite", () => {
    expect(sortearLata({ tipo: "galao" })).toBeNull();
  });
});

describe("coordenadas dos temas", () => {
  it("mantem todo HUD dentro do palco", () => {
    // Coordenada fora de 0-100 poe o numero fora da tela, e isso so apareceria
    // no evento.
    for (const tema of Object.values(TEMAS)) {
      const pecas = [tema.hud.tempo, tema.hud.nivel, tema.hud.pontos].filter(
        (p) => p !== undefined,
      );
      for (const peca of pecas) {
        expect(peca.x).toBeGreaterThanOrEqual(0);
        expect(peca.x).toBeLessThanOrEqual(100);
        expect(peca.y).toBeGreaterThanOrEqual(0);
        expect(peca.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("registra o tema sob a chave igual ao proprio nome", () => {
    for (const [chave, tema] of Object.entries(TEMAS)) {
      expect(tema.nome).toBe(chave);
    }
  });
});
