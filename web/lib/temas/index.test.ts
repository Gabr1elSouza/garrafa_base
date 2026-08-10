import { describe, expect, it } from "vitest";
import { resolverTema, TEMAS, TEMA_PADRAO } from "./index";

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

describe("alvo e deposito dos temas", () => {
  it("poe a boca acima do chao", () => {
    for (const tema of Object.values(TEMAS)) {
      expect(tema.alvo.y).toBeGreaterThan(tema.alvo.chao);
    }
  });

  it("mantem o liquido da jarra dentro dela", () => {
    for (const tema of Object.values(TEMAS)) {
      if (tema.deposito.onde !== "cena") continue;
      const { fundo, altura, raio } = tema.deposito;
      expect(fundo).toBeGreaterThanOrEqual(tema.alvo.chao);
      // Liquido acima da boca transborda e denuncia o palpite.
      expect(fundo + altura).toBeLessThanOrEqual(tema.alvo.y);
      // Mais largo que o corpo e ele aparece atravessando a parede.
      expect(raio).toBeLessThanOrEqual(tema.alvo.raio + 0.16);
    }
  });

  it("mantem a faixa do liquido na arte dentro do palco e de cabeca para cima", () => {
    for (const tema of Object.values(TEMAS)) {
      if (tema.deposito.onde !== "arte") continue;
      const { base, topo } = tema.deposito;
      // `base` e o fundo do copo, entao esta mais abaixo na tela que `topo`.
      // Invertidos, a altura fica negativa e o liquido some sem erro nenhum.
      expect(base).toBeGreaterThan(topo);
      expect(topo).toBeGreaterThanOrEqual(0);
      expect(base).toBeLessThanOrEqual(100);
    }
  });

  it("exige backdrop de quem tem recipiente na arte", () => {
    // A arte com copo tem o interior transparente: sem camada opaca atras, o
    // copo vazio mostra o preto do palco e vira um buraco.
    for (const tema of Object.values(TEMAS)) {
      if (tema.deposito.onde === "arte") expect(tema.backdrop).toBeTruthy();
    }
  });

  it("pendura o recipiente de cima acima da boca do de baixo", () => {
    // O recipiente pendura a partir do bico, entao `bocal` e `altura` andam
    // juntas. Aumentar a lata sem subir o bico afunda a base dela dentro do
    // copo — e isso so aparece na tela, nunca num erro.
    for (const tema of Object.values(TEMAS)) {
      if (tema.recipiente.tipo !== "modelo") continue;
      const base = tema.bocal - tema.recipiente.altura;
      expect(base).toBeGreaterThan(tema.alvo.y);
    }
  });

  it("so tira a jarra da cena quando a arte tem recipiente proprio", () => {
    // O `oleo` aponta para arte placeholder sem recipiente desenhado: sem a
    // jarra procedural o oleo cairia no vazio.
    expect(TEMAS.oleo.deposito.onde).toBe("cena");
    expect(TEMAS.redbull.deposito.onde).toBe("arte");
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
