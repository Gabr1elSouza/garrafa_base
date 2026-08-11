import { describe, expect, it } from "vitest";
import { decodeState, PACKET_SIZE } from "./packet";

/**
 * Monta um pacote do tamanho corrente a partir dos bytes que o teste se importa.
 *
 * O resto vai a zero em vez de o teste soletrar os nove bytes toda vez: assim
 * um campo novo no fim do pacote nao quebra os casos que nao falam dele.
 */
function packet(bytes: number[]): DataView {
  const buf = new Uint8Array(PACKET_SIZE);
  buf.set(bytes.slice(0, PACKET_SIZE));
  return new DataView(buf.buffer);
}

/** Decimos de grau, little-endian, do jeito que o firmware manda. */
function tiltBytes(graus: number): [number, number] {
  const deci = Math.round(graus * 10);
  return [deci & 0xff, deci >> 8];
}

describe("decodeState", () => {
  it("le um pacote de garrafa parada", () => {
    // status=0, angulo=0, taxa=0, seq=0, flags=0, inclinacao=0
    const state = decodeState(packet([0, 0, 0, 0, 0, 0, 0, 0]));
    expect(state).toEqual({
      status: "idle",
      angle: 0,
      rate: 0,
      seq: 0,
      saturated: false,
      calibrating: false,
      tilt: 0,
    });
  });

  it("le os dois bits de flag separados", () => {
    const flags = (b: number) => decodeState(packet([0, 0, 0, 0, 0, 0, b, 0]));
    expect(flags(0x00)).toMatchObject({ saturated: false, calibrating: false });
    expect(flags(0x01)).toMatchObject({ saturated: true, calibrating: false });
    expect(flags(0x02)).toMatchObject({ saturated: false, calibrating: true });
    expect(flags(0x03)).toMatchObject({ saturated: true, calibrating: true });
  });

  it("le a inclinacao dos dois ultimos bytes", () => {
    expect(decodeState(packet([0, 0, 0, 0, 0, 0, 0, ...tiltBytes(47)])).tilt)
      .toBe(47);
    expect(decodeState(packet([0, 0, 0, 0, 0, 0, 0, ...tiltBytes(180)])).tilt)
      .toBe(180);
  });

  it("le a inclinacao em decimos de grau", () => {
    // O jato abre em 25 graus: a fracao entre um grau e o seguinte tem que
    // sobreviver ao transporte, senao a vazao anda em degraus.
    expect(decodeState(packet([0, 0, 0, 0, 0, 0, 0, ...tiltBytes(25.4)])).tilt)
      .toBeCloseTo(25.4, 5);
    expect(decodeState(packet([0, 0, 0, 0, 0, 0, 0, ...tiltBytes(0.7)])).tilt)
      .toBeCloseTo(0.7, 5);
  });

  it("le inclinacao junto com os outros campos sem embaralhar", () => {
    // angulo 90.00, taxa -300, seq 7, saturou, inclinacao 62.5
    const state = decodeState(
      packet([1, 0x28, 0x23, 0xd4, 0xfe, 7, 0x01, ...tiltBytes(62.5)]),
    );
    expect(state.angle).toBeCloseTo(90, 5);
    expect(state.rate).toBe(-300);
    expect(state.seq).toBe(7);
    expect(state.saturated).toBe(true);
    expect(state.tilt).toBeCloseTo(62.5, 5);
  });

  it("converte centesimos de grau em graus", () => {
    // 18742 centesimos = 187.42 graus
    const state = decodeState(packet([1, 0x36, 0x49, 0, 0, 0, 0, 0]));
    expect(state.angle).toBeCloseTo(187.42, 5);
    expect(state.status).toBe("spinning");
  });

  it("le o angulo maximo", () => {
    // 35999 centesimos = 359.99 graus
    const state = decodeState(packet([0, 0x9f, 0x8c, 0, 0, 0, 0, 0]));
    expect(state.angle).toBeCloseTo(359.99, 5);
  });

  it("le taxa negativa como int16 com sinal", () => {
    // -1200 em complemento de dois little-endian = 0x50 0xFB
    const state = decodeState(packet([1, 0, 0, 0x50, 0xfb, 0, 0, 0]));
    expect(state.rate).toBe(-1200);
  });

  it("le taxa positiva no limite do fundo de escala", () => {
    // 2000 = 0xD0 0x07
    const state = decodeState(packet([1, 0, 0, 0xd0, 0x07, 0, 0, 0]));
    expect(state.rate).toBe(2000);
  });

  it("reconhece o evento de parada e o numero de sequencia", () => {
    const state = decodeState(packet([2, 0, 0, 0, 0, 42, 0, 0]));
    expect(state.status).toBe("stopped");
    expect(state.seq).toBe(42);
  });

  it("le o bit de saturacao", () => {
    expect(decodeState(packet([0, 0, 0, 0, 0, 0, 0x01, 0])).saturated).toBe(
      true,
    );
    expect(decodeState(packet([0, 0, 0, 0, 0, 0, 0x00, 0])).saturated).toBe(
      false,
    );
  });

  it("trata status desconhecido como parada", () => {
    expect(decodeState(packet([9, 0, 0, 0, 0, 0, 0, 0])).status).toBe("idle");
  });

  it("recusa pacote curto", () => {
    // Sem o `packet()`, que completa com zeros: aqui o ponto e justamente o
    // pacote menor que o combinado.
    const curto = new DataView(new Uint8Array(PACKET_SIZE - 1).buffer);
    expect(() => decodeState(curto)).toThrow();
    expect(PACKET_SIZE).toBe(9);
  });
});
