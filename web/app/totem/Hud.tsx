"use client";

import { formatarTempo } from "@/lib/game/pour";
import { ARTE, posicaoNoPalco } from "@/lib/totem/arte";
import { PALCO_A } from "@/lib/totem/palco";

type Props = {
  /** 0 a 1. */
  nivel: number;
  /** Segundos. */
  tempo: number;
  venceu: boolean;
};

export function Hud({ nivel, tempo, venceu }: Props) {
  return (
    <>
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 font-mono font-black tabular-nums text-white"
        style={{
          ...posicaoNoPalco(ARTE.tempo.x, ARTE.tempo.y),
          fontSize: `${(ARTE.tempo.tamanho / 100) * PALCO_A}px`,
          textShadow: "0 0 40px rgba(0,0,0,0.8)",
        }}
      >
        {formatarTempo(tempo)}
      </div>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          ...posicaoNoPalco(ARTE.nivel.x, ARTE.nivel.y),
          width: `${ARTE.nivel.largura}%`,
        }}
      >
        <div className="mb-3 flex items-baseline justify-between text-3xl font-bold text-white/80">
          <span>JARRA</span>
          <span className="tabular-nums">{Math.round(nivel * 100)}%</span>
        </div>
        <div className="h-10 overflow-hidden rounded-full bg-black/50 ring-4 ring-white/20">
          <div
            className="h-full rounded-full bg-amber-400 transition-[width] duration-100"
            style={{ width: `${nivel * 100}%` }}
          />
        </div>
      </div>

      {venceu && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center">
          <p className="text-8xl font-black text-amber-300">JARRA CHEIA!</p>
          <p className="mt-8 font-mono text-9xl font-black tabular-nums text-white">
            {formatarTempo(tempo)}
          </p>
        </div>
      )}
    </>
  );
}
