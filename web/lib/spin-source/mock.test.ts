import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockSpinSource } from "./mock";
import type { SpinState } from "./types";

describe("MockSpinSource", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function coletar() {
    const source = new MockSpinSource();
    const states: SpinState[] = [];
    source.subscribe((s) => states.push(s));
    return { source, states };
  }

  it("todo giro converge para uma parada", () => {
    const { source, states } = coletar();
    source.spin();
    vi.advanceTimersByTime(30_000);

    const parada = states.filter((s) => s.status === "stopped");
    expect(parada).toHaveLength(1);
    expect(states.at(-1)?.rate).toBe(0);
  });

  it("incrementa seq uma unica vez por giro", () => {
    const { source, states } = coletar();

    source.spin();
    vi.advanceTimersByTime(30_000);
    source.spin();
    vi.advanceTimersByTime(30_000);

    const paradas = states.filter((s) => s.status === "stopped");
    expect(paradas.map((s) => s.seq)).toEqual([1, 2]);
  });

  it("ignora giro novo enquanto ainda esta girando", () => {
    const { source, states } = coletar();

    source.spin();
    vi.advanceTimersByTime(200);
    source.spin(); // deve ser ignorado
    vi.advanceTimersByTime(30_000);

    expect(states.filter((s) => s.status === "stopped")).toHaveLength(1);
  });

  it("mantem o angulo dentro de 0..360", () => {
    const { source, states } = coletar();
    source.spin();
    vi.advanceTimersByTime(30_000);

    for (const s of states) {
      expect(s.angle).toBeGreaterThanOrEqual(0);
      expect(s.angle).toBeLessThan(360);
    }
  });

  it("o atrito nunca inverte o sentido do giro", () => {
    const { source, states } = coletar();
    source.spin();
    vi.advanceTimersByTime(30_000);

    const girando = states.filter((s) => s.status === "spinning" && s.rate !== 0);
    const sentidos = new Set(girando.map((s) => Math.sign(s.rate)));
    expect(sentidos.size).toBe(1);
  });

  it("entrega o estado de conexao a quem se inscreve depois do connect", async () => {
    // A UI so consegue se inscrever depois que `connect()` resolve. Se a fonte
    // apenas emitisse eventos, o "conectou" se perderia e a tela ficaria presa
    // em desconectado.
    const source = new MockSpinSource();
    await source.connect();

    const vistos: boolean[] = [];
    source.subscribeConnection((c) => vistos.push(c));

    expect(vistos).toEqual([true]);
  });

  it("avisa os inscritos quando desconecta", async () => {
    const source = new MockSpinSource();
    await source.connect();

    const vistos: boolean[] = [];
    source.subscribeConnection((c) => vistos.push(c));
    await source.disconnect();

    expect(vistos).toEqual([true, false]);
  });

  it("nao repete o mesmo estado de conexao", async () => {
    const source = new MockSpinSource();
    await source.connect();

    const vistos: boolean[] = [];
    source.subscribeConnection((c) => vistos.push(c));
    await source.connect(); // ja estava conectado

    expect(vistos).toEqual([true]);
  });

  it("zerar leva o angulo de volta para 0", async () => {
    const { source, states } = coletar();
    source.spin();
    vi.advanceTimersByTime(30_000);

    await source.send("zero");
    expect(states.at(-1)?.angle).toBe(0);
  });
});
