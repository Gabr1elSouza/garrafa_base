"use client";

import { aberturaDoJato } from "@/lib/game/pour";
import type { SpinState } from "@/lib/spin-source/types";

type Props = {
  connected: boolean;
  kind: "ble" | "mock" | null;
  state: SpinState;
  error: string | null;
};

export function StatusBar({ connected, kind, state, error }: Props) {
  const label = !connected
    ? "Desconectado"
    : kind === "mock"
      ? "Simulador"
      : "Garrafa conectada";

  const jato = Math.round(aberturaDoJato(state.tilt) * 100);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block h-2 w-2 rounded-full ${
            connected ? "bg-emerald-400" : "bg-zinc-600"
          }`}
        />
        {label}
      </span>

      {connected && (
        <>
          <span className="tabular-nums">inclinação {state.tilt}°</span>
          <span
            className={`tabular-nums ${jato > 0 ? "text-amber-300" : ""}`}
          >
            jato {jato}%
          </span>
        </>
      )}

      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
