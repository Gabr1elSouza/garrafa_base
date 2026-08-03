import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { criarAlca, criarCorpo, criarGargalo, criarTampa } from "./galao";

/** Caixa envolvente de uma geometria ja posicionada. */
function caixa(geo: THREE.BufferGeometry): THREE.Box3 {
  geo.computeBoundingBox();
  return geo.boundingBox as THREE.Box3;
}

describe("galao", () => {
  it("poe a boca da tampa na origem", () => {
    const c = caixa(criarTampa());
    expect(c.max.y).toBeCloseTo(0, 2);
  });

  it("centra a tampa no eixo, para o jato sair do bico", () => {
    const c = caixa(criarTampa());
    const centro = new THREE.Vector3();
    c.getCenter(centro);
    expect(centro.x).toBeCloseTo(0, 2);
    expect(centro.z).toBeCloseTo(0, 2);
  });

  it("nao deixa nenhuma peca subir acima do bico", () => {
    for (const geo of [criarCorpo(), criarAlca(), criarGargalo(), criarTampa()]) {
      expect(caixa(geo).max.y).toBeLessThanOrEqual(0.001);
    }
  });

  it("pendura o corpo abaixo, terminando perto de -1.86", () => {
    const c = caixa(criarCorpo());
    expect(c.min.y).toBeCloseTo(-1.86, 1);
    expect(c.max.y).toBeLessThan(-0.3);
  });

  it("faz o corpo mais largo que profundo: a silhueta e achatada", () => {
    const c = caixa(criarCorpo());
    const largura = c.max.x - c.min.x;
    const profundidade = c.max.z - c.min.z;
    expect(largura).toBeGreaterThan(profundidade * 1.5);
  });

  it("centra o corpo na profundidade", () => {
    // Pega o erro de centrar pelo numero errado depois do bisel: a peca fica
    // torta em Z por uma fracao que nenhum outro teste enxerga.
    const centro = new THREE.Vector3();
    caixa(criarCorpo()).getCenter(centro);
    expect(centro.z).toBeCloseTo(0, 2);
  });

  it("desloca o corpo para a esquerda do bico", () => {
    const centro = new THREE.Vector3();
    caixa(criarCorpo()).getCenter(centro);
    expect(centro.x).toBeLessThan(-0.2);
  });

  it("poe a alca do lado oposto ao gargalo", () => {
    const centro = new THREE.Vector3();
    caixa(criarAlca()).getCenter(centro);
    expect(centro.x).toBeLessThan(-0.6);
  });

  it("vaza a alca: o furo tira volume do meio", () => {
    const comFuro = criarAlca().attributes.position.count;
    expect(comFuro).toBeGreaterThan(0);
    const c = caixa(criarAlca());
    // A alca e mais alta que larga: e uma argola vertical, nao um bloco.
    expect(c.max.y - c.min.y).toBeGreaterThan(c.max.x - c.min.x);
  });
});
