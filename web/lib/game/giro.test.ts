import { describe, expect, it } from "vitest";
import { menorDiferencaAngular } from "./giro";

describe("menorDiferencaAngular", () => {
  it("nao se move quando o angulo nao mudou", () => {
    expect(menorDiferencaAngular(0, 0)).toBe(0);
    expect(menorDiferencaAngular(217, 217)).toBe(0);
  });

  it("anda para frente dentro da mesma volta", () => {
    expect(menorDiferencaAngular(10, 40)).toBe(30);
    expect(menorDiferencaAngular(100, 190)).toBe(90);
  });

  it("anda para tras dentro da mesma volta", () => {
    expect(menorDiferencaAngular(40, 10)).toBe(-30);
  });

  it("cruza o zero pelo caminho curto", () => {
    // O bug que esta funcao existe para evitar: sem ela, 359 -> 1 vira -358.
    expect(menorDiferencaAngular(359, 1)).toBe(2);
    expect(menorDiferencaAngular(1, 359)).toBe(-2);
    expect(menorDiferencaAngular(350, 20)).toBe(30);
  });

  it("nunca devolve caminho maior que meia volta", () => {
    for (let de = 0; de < 360; de += 7) {
      for (let para = 0; para < 360; para += 11) {
        const d = menorDiferencaAngular(de, para);
        expect(Math.abs(d)).toBeLessThanOrEqual(180);
      }
    }
  });

  it("chega no destino somando a diferenca", () => {
    for (let de = 0; de < 360; de += 13) {
      for (let para = 0; para < 360; para += 17) {
        const chegada = (((de + menorDiferencaAngular(de, para)) % 360) + 360) % 360;
        expect(chegada).toBeCloseTo(para, 9);
      }
    }
  });

  it("resolve a meia volta exata sempre para o mesmo lado", () => {
    // Empate: os dois caminhos medem 180. Alternar entre eles faria a lata
    // tremer quando o angulo ficasse rondando essa fronteira.
    expect(menorDiferencaAngular(0, 180)).toBe(180);
    expect(menorDiferencaAngular(180, 0)).toBe(180);
    expect(menorDiferencaAngular(90, 270)).toBe(180);
  });

  it("aceita angulo fora de 0..360", () => {
    // O firmware normaliza, mas o mock e os testes nao precisam saber disso.
    expect(menorDiferencaAngular(-10, 10)).toBe(20);
    expect(menorDiferencaAngular(730, 10)).toBe(0);
  });

  it("devolve zero para entrada invalida em vez de propagar NaN", () => {
    // Um NaN aqui contaminaria a rotacao do grupo e a lata sumiria da cena sem
    // erro nenhum no console.
    expect(menorDiferencaAngular(NaN, 10)).toBe(0);
    expect(menorDiferencaAngular(10, Infinity)).toBe(0);
  });
});
