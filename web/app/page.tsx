"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PourScene } from "@/components/PourScene";
import { StatusBar } from "@/components/StatusBar";
import {
  formatarTempo,
  nivelDeEnchimento,
  precisao,
  TILT_MINIMO,
} from "@/lib/game/pour";
import { bluetoothAvailability } from "@/lib/spin-source/availability";
import { BleSpinSource, ConnectionCancelled } from "@/lib/spin-source/ble";
import { MockSpinSource } from "@/lib/spin-source/mock";
import {
  INITIAL_STATE,
  type SpinSource,
  type SpinState,
} from "@/lib/spin-source/types";

type Fase = "pronto" | "jogando" | "venceu";

/** Item da lista de opções. Alinhado à esquerda, sem borda: é lista, não botão. */
const ITEM_OPCAO =
  "rounded-md px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900";

export default function Home() {
  const bluetoothReady = useSyncExternalStore(
    bluetoothAvailability.subscribe,
    bluetoothAvailability.getSnapshot,
    bluetoothAvailability.getServerSnapshot,
  );

  const [source, setSource] = useState<SpinSource | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [state, setState] = useState<SpinState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);

  const [fase, setFase] = useState<Fase>("pronto");
  const [acertos, setAcertos] = useState(0);
  const [perdidas, setPerdidas] = useState(0);
  const [tempo, setTempo] = useState(0);
  const [round, setRound] = useState(0);
  const inicio = useRef(0);
  const faseRef = useRef<Fase>("pronto");

  // --- fonte de dados ------------------------------------------------------
  useEffect(() => {
    if (!source) return;

    const unsubState = source.subscribe(setState);
    const unsubConn = source.subscribeConnection((isConnected) => {
      setConnected(isConnected);
      if (!isConnected) {
        setState(INITIAL_STATE);
        setError("A garrafa desconectou.");
      }
    });

    return () => {
      unsubState();
      unsubConn();
    };
  }, [source]);

  // --- cronometro ----------------------------------------------------------
  useEffect(() => {
    if (fase !== "jogando") return;
    const id = setInterval(
      () => setTempo((performance.now() - inicio.current) / 1000),
      50,
    );
    return () => clearInterval(id);
  }, [fase]);

  // As viradas de fase sao reacao ao que a cena reporta, nao sincronizacao de
  // estado, entao acontecem aqui e nao dentro de um efeito. O ref espelha a
  // fase para que este callback nao precise ser recriado a cada mudanca.
  const onProgress = useCallback((a: number, p: number) => {
    setAcertos(a);
    setPerdidas(p);

    if (faseRef.current === "pronto" && a + p > 0) {
      // A partida comeca na primeira gota derramada, nao num botao: assim o
      // cronometro mede so o tempo de jogo.
      faseRef.current = "jogando";
      inicio.current = performance.now();
      setFase("jogando");
    } else if (faseRef.current === "jogando" && nivelDeEnchimento(a) >= 1) {
      faseRef.current = "venceu";
      setFase("venceu");
    }
  }, []);

  const reiniciar = useCallback(() => {
    faseRef.current = "pronto";
    setRound((r) => r + 1);
    setAcertos(0);
    setPerdidas(0);
    setTempo(0);
    setFase("pronto");
  }, []);

  // --- conexao -------------------------------------------------------------
  const start = useCallback(async (next: SpinSource) => {
    setError(null);
    setConnecting(true);
    try {
      await next.connect();
      setSource(next);
    } catch (err) {
      if (err instanceof ConnectionCancelled) return;
      setError(err instanceof Error ? err.message : "Falha ao conectar.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    await source?.disconnect();
    setSource(null);
    setConnected(false);
    setState(INITIAL_STATE);
  }, [source]);

  const mock = source instanceof MockSpinSource ? source : null;

  // Barra de espaco derrama no simulador.
  useEffect(() => {
    if (!mock) return;

    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      mock.setPouring(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      mock.setPouring(false);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [mock]);

  const nivel = nivelDeEnchimento(acertos);
  const mira = Math.round(precisao(acertos, perdidas) * 100);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-black tracking-tight">Encha a Jarra</h1>
        <StatusBar
          connected={connected}
          kind={source?.kind ?? null}
          state={state}
          error={error}
        />
      </header>

      <div className="flex flex-1 flex-col-reverse items-center gap-8 lg:flex-row lg:items-start">
        <aside className="flex w-full max-w-xs flex-col gap-5">
          <div className="space-y-3 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-zinc-400">Tempo</span>
              <span className="font-mono text-2xl tabular-nums">
                {formatarTempo(tempo)}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-sm text-zinc-400">
                <span>Jarra</span>
                <span className="tabular-nums">{Math.round(nivel * 100)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-[width] duration-100"
                  style={{ width: `${nivel * 100}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-sm text-zinc-500">
              <span>Mira</span>
              <span className="tabular-nums">{mira}%</span>
            </div>
          </div>

          {fase === "venceu" && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-lg font-bold text-emerald-300">Jarra cheia!</p>
              <p className="mt-1 text-sm text-zinc-300">
                {formatarTempo(tempo)} com {mira}% de mira.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {!connected ? (
              <>
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => start(new BleSpinSource())}
                  className="rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {connecting ? "Conectando…" : "Conectar garrafa"}
                </button>

                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => start(new MockSpinSource())}
                  className="rounded-lg border border-zinc-700 px-4 py-2.5 text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50"
                >
                  Usar simulador
                </button>

                {!bluetoothReady && (
                  <p className="text-sm text-amber-400">
                    Este navegador não tem Web Bluetooth. Use Chrome ou Edge, ou
                    jogue no simulador.
                  </p>
                )}
              </>
            ) : (
              <>
                {mock && (
                  <button
                    type="button"
                    onPointerDown={() => mock.setPouring(true)}
                    onPointerUp={() => mock.setPouring(false)}
                    onPointerLeave={() => mock.setPouring(false)}
                    className="select-none rounded-lg bg-amber-500 px-4 py-3 font-semibold text-black transition hover:bg-amber-400"
                  >
                    Segure para derramar{" "}
                    <span className="opacity-60">(espaço)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={reiniciar}
                  className="rounded-lg bg-zinc-100 px-4 py-2.5 font-semibold text-black transition hover:bg-white"
                >
                  Jogar de novo
                </button>

                {/* Tudo que não é jogar mora aqui dentro. São ações de sensor,
                    usadas uma vez no começo e raramente depois: soltas na
                    coluna elas competiam com o botão que a pessoa realmente
                    quer. `details` abre e fecha sozinho, sem estado. */}
                <details className="group rounded-lg border border-zinc-800">
                  <summary className="cursor-pointer list-none px-4 py-2 text-sm text-zinc-400 transition hover:text-zinc-200">
                    Opções
                    <span className="float-right transition-transform group-open:rotate-180">
                      ⌄
                    </span>
                  </summary>

                  <div className="flex flex-col gap-2 border-t border-zinc-800 p-2">
                    {source?.kind === "ble" && (
                      <>
                        <button
                          type="button"
                          onClick={() => source.send("level")}
                          title="Segure a garrafa parada na posição de descanso e clique. Essa pose vira 0°."
                          className={ITEM_OPCAO}
                        >
                          Marcar posição atual como 0°
                        </button>

                        <button
                          type="button"
                          onClick={() => source.send("calibrate")}
                          title="Deixe a garrafa parada numa superfície firme. Leva cerca de 3 segundos."
                          className={ITEM_OPCAO}
                        >
                          Recalibrar giroscópio
                        </button>

                        <button
                          type="button"
                          onClick={() => source.send("zero")}
                          title="Zera só o giro em torno do próprio eixo. Não mexe na inclinação."
                          className={ITEM_OPCAO}
                        >
                          Zerar giro
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={stop}
                      className="rounded-md px-3 py-2 text-left text-sm text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-300"
                    >
                      Desconectar
                    </button>
                  </div>
                </details>
              </>
            )}
          </div>

          <p className="text-sm leading-relaxed text-zinc-500">
            Incline a garrafa além de {TILT_MINIMO}° para abrir o jato. Quanto
            mais inclina, mais forte. A garrafa vai e volta sozinha — acerte a
            jarra parada embaixo.
          </p>

          {source?.kind === "ble" && (
            <p className="text-sm leading-relaxed text-zinc-500">
              A inclinação é medida a partir da posição marcada como 0°. Segure
              a garrafa como vai segurar durante o jogo e marque o zero antes de
              começar.
            </p>
          )}
        </aside>

        <div className="flex flex-1 items-center justify-center">
          <PourScene
            tilt={state.tilt}
            angle={state.angle}
            running={connected && fase !== "venceu"}
            round={round}
            onProgress={onProgress}
          />
        </div>
      </div>
    </main>
  );
}
