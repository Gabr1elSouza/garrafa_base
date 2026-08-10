"use client";

import { useSyncExternalStore } from "react";
import { bluetoothAvailability } from "@/lib/spin-source/availability";
import { MockSpinSource } from "@/lib/spin-source/mock";
import type { SpinSource } from "@/lib/spin-source/types";
import { contextoSeguro } from "@/lib/totem/ambiente";

type Props = {
  aberto: boolean;
  source: SpinSource | null;
  connected: boolean;
  connecting: boolean;
  erro: string | null;
  aoConectar: () => void;
  aoSimular: () => void;
  aoDesconectar: () => void;
  aoZerar: () => void;
  aoFechar: () => void;
};

export function Operador({
  aberto,
  source,
  connected,
  connecting,
  erro,
  aoConectar,
  aoSimular,
  aoDesconectar,
  aoZerar,
  aoFechar,
}: Props) {
  const bluetoothReady = useSyncExternalStore(
    bluetoothAvailability.subscribe,
    bluetoothAvailability.getSnapshot,
    bluetoothAvailability.getServerSnapshot,
  );
  const seguro = useSyncExternalStore(
    contextoSeguro.subscribe,
    contextoSeguro.getSnapshot,
    contextoSeguro.getServerSnapshot,
  );

  if (!aberto) return null;

  const mock = source instanceof MockSpinSource ? source : null;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8 bg-black/85 p-16 text-white"
      onClick={connected ? aoFechar : undefined}
    >
      <div
        className="flex w-full flex-col items-stretch gap-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-4xl font-bold tracking-widest">
          {connected
            ? source?.kind === "mock"
              ? "SIMULADOR"
              : "GARRAFA ONLINE"
            : "DESCONECTADO"}
        </p>

        {erro && (
          <p className="rounded-2xl border-4 border-red-500 bg-red-950 p-6 text-center text-3xl text-red-200">
            {erro}
          </p>
        )}

        {!connected ? (
          <>
            <button
              type="button"
              onClick={aoConectar}
              disabled={connecting}
              className="rounded-3xl bg-emerald-500 px-12 py-10 text-5xl font-black text-black disabled:opacity-50"
            >
              {connecting ? "Conectando…" : "Conectar garrafa"}
            </button>
            <button
              type="button"
              onClick={aoSimular}
              disabled={connecting}
              className="rounded-3xl border-4 border-white/30 px-12 py-10 text-5xl font-bold disabled:opacity-50"
            >
              Usar simulador
            </button>

            {!seguro ? (
              <p className="rounded-2xl border-4 border-amber-500 bg-amber-950 p-6 text-center text-3xl text-amber-100">
                Esta página está aberta pelo IP da rede. O navegador só libera
                Bluetooth em http://localhost — abra por ali, ou jogue no
                simulador.
              </p>
            ) : (
              !bluetoothReady && (
                <p className="rounded-2xl border-4 border-amber-500 bg-amber-950 p-6 text-center text-3xl text-amber-100">
                  Este navegador não tem Web Bluetooth. Use Chrome ou Edge, ou
                  jogue no simulador.
                </p>
              )
            )}
          </>
        ) : (
          <>
            {mock && (
              <>
                <button
                  type="button"
                  onPointerDown={() => mock.setPouring(true)}
                  onPointerUp={() => mock.setPouring(false)}
                  onPointerLeave={() => mock.setPouring(false)}
                  className="select-none rounded-3xl bg-amber-500 px-12 py-10 text-5xl font-black text-black"
                >
                  Segure para derramar
                </button>

                {/* O giro so existe no sensor real; sem isto nao ha como ver a
                    lata rodar, nem demonstrar o jogo se o BLE falhar. */}
                <button
                  type="button"
                  onClick={() => mock.spin()}
                  className="rounded-3xl border-4 border-white/30 px-12 py-8 text-4xl font-bold"
                >
                  Girar lata
                </button>
              </>
            )}

            {source?.kind === "ble" && (
              <button
                type="button"
                onClick={aoZerar}
                className="rounded-3xl border-4 border-white/30 px-12 py-8 text-4xl font-bold"
              >
                Marcar posição atual como 0°
              </button>
            )}

            <button
              type="button"
              onClick={aoDesconectar}
              className="rounded-3xl border-4 border-white/30 px-12 py-8 text-4xl font-bold"
            >
              Desconectar
            </button>

            <p className="text-center text-2xl text-white/40">
              Toque fora para voltar ao jogo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
