import { describe, expect, it } from "vitest";
import { escalaDoPalco } from "./palco";

describe("escalaDoPalco", () => {
  it("da 1 no painel de 1080x1920 exatos", () => {
    expect(escalaDoPalco(1080, 1920)).toBe(1);
  });

  it("limita pela altura quando a janela e larga demais", () => {
    // 3000/1080 = 2.77 de folga na largura; a altura e quem aperta.
    expect(escalaDoPalco(3000, 960)).toBeCloseTo(0.5);
  });

  it("limita pela largura quando a janela e alta demais", () => {
    expect(escalaDoPalco(540, 3000)).toBeCloseTo(0.5);
  });

  it("nunca devolve zero ou negativo com medidas invalidas", () => {
    expect(escalaDoPalco(0, 0)).toBe(1);
    expect(escalaDoPalco(-100, 500)).toBe(1);
    expect(escalaDoPalco(Number.NaN, 1920)).toBe(1);
  });
});
