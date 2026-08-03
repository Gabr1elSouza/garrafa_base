import { describe, expect, it } from "vitest";
import { posicaoNoPalco } from "./posicao";

describe("posicaoNoPalco", () => {
  it("converte percentual em left e top", () => {
    expect(posicaoNoPalco(50, 25)).toEqual({ left: "50%", top: "25%" });
  });

  it("prende valores acima de 100", () => {
    expect(posicaoNoPalco(140, 300)).toEqual({ left: "100%", top: "100%" });
  });

  it("prende valores negativos em zero", () => {
    expect(posicaoNoPalco(-20, -1)).toEqual({ left: "0%", top: "0%" });
  });

  it("trata numero invalido como zero", () => {
    expect(posicaoNoPalco(Number.NaN, 10)).toEqual({ left: "0%", top: "10%" });
  });
});
