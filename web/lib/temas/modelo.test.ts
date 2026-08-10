import { describe, expect, it } from "vitest";
import { ajusteDoModelo, type Caixa } from "./modelo";

/** Caixa do `red_bull.glb` depois da matriz do no raiz: em pe no Y, base em 0. */
const LATA: Caixa = {
  min: { x: -0.994, y: 0, z: -0.994 },
  max: { x: 0.994, y: 5.535, z: 0.994 },
};

describe("ajusteDoModelo", () => {
  it("escala pela altura pedida", () => {
    const { escala } = ajusteDoModelo(LATA, 2.16);
    expect(escala).toBeCloseTo(2.16 / 5.535, 6);
  });

  it("poe o topo do modelo na origem", () => {
    // A boca precisa cair em y=0 do grupo: e de la que as gotas nascem.
    const { escala, offset } = ajusteDoModelo(LATA, 2.16);
    expect(LATA.max.y * escala + offset.y).toBeCloseTo(0, 9);
  });

  it("deixa a base uma altura inteira abaixo da origem", () => {
    const alvo = 2.16;
    const { escala, offset } = ajusteDoModelo(LATA, alvo);
    expect(LATA.min.y * escala + offset.y).toBeCloseTo(-alvo, 9);
  });

  it("centra x e z para o giro nao virar cone", () => {
    const { escala, offset } = ajusteDoModelo(LATA, 2.16);
    expect((LATA.min.x + LATA.max.x) / 2 * escala + offset.x).toBeCloseTo(0, 9);
    expect((LATA.min.z + LATA.max.z) / 2 * escala + offset.z).toBeCloseTo(0, 9);
  });

  it("centra x e z mesmo com o modelo torto no arquivo", () => {
    // Nem todo exportador deixa o objeto na origem. Se o centro nao for
    // corrigido, girar em Y faz a lata orbitar em vez de girar parada.
    const torta: Caixa = {
      min: { x: 3, y: 0, z: -7 },
      max: { x: 5, y: 10, z: -5 },
    };
    const { escala, offset } = ajusteDoModelo(torta, 2);
    expect(4 * escala + offset.x).toBeCloseTo(0, 9);
    expect(-6 * escala + offset.z).toBeCloseTo(0, 9);
  });

  it("nao explode com modelo de altura zero", () => {
    const chata: Caixa = {
      min: { x: 0, y: 1, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    };
    const { escala, offset } = ajusteDoModelo(chata, 2.16);
    expect(escala).toBe(1);
    expect(Number.isFinite(offset.x)).toBe(true);
    expect(Number.isFinite(offset.y)).toBe(true);
    expect(Number.isFinite(offset.z)).toBe(true);
  });
});
