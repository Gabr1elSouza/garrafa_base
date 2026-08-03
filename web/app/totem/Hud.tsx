"use client";

import { formatarTempo } from "@/lib/game/pour";
import type { Tema } from "@/lib/temas";
import { PALCO_A } from "@/lib/totem/palco";
import { posicaoNoPalco } from "@/lib/totem/posicao";

type Props = {
  tema: Tema;
  /** Gotas que entraram na jarra. */
  acertos: number;
  /** 0 a 1. */
  nivel: number;
  /** Segundos. */
  tempo: number;
  venceu: boolean;
};

/** Percentual de altura do palco vira tamanho de fonte em pixel. */
function fonte(tamanho: number): string {
  return `${(tamanho / 100) * PALCO_A}px`;
}

export function Hud({ tema, acertos, nivel, tempo, venceu }: Props) {
  const { pontos, tempo: caixaTempo, nivel: barra } = tema.hud;

  return (
    <>
      {/* Os rotulos PONTOS e TEMPO ja vem desenhados no fundo do tema: aqui so
          o valor, senao o texto aparece duas vezes. */}
      {pontos && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 font-black tabular-nums text-[#c8102e]"
          style={{
            ...posicaoNoPalco(pontos.x, pontos.y),
            fontSize: fonte(pontos.tamanho),
          }}
        >
          {acertos}
        </div>
      )}

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 font-mono font-black tabular-nums text-[#c8102e]"
        style={{
          ...posicaoNoPalco(caixaTempo.x, caixaTempo.y),
          fontSize: fonte(caixaTempo.tamanho),
        }}
      >
        {formatarTempo(tempo)}
      </div>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          ...posicaoNoPalco(barra.x, barra.y),
          width: `${barra.largura}%`,
        }}
      >
        <div className="mb-3 flex items-baseline justify-between text-3xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
          <span>JARRA</span>
          <span className="tabular-nums">{Math.round(nivel * 100)}%</span>
        </div>
        <div className="h-10 overflow-hidden rounded-full bg-black/50 ring-4 ring-white/40">
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
