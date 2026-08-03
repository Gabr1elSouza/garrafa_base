"use client";

import { useRef, useState } from "react";
import { ARTE, type Arte } from "@/lib/totem/arte";

const LINHAS = Array.from({ length: 19 }, (_, i) => (i + 1) * 100);

type Peca = "nivel" | "tempo";

export function Calibrador() {
  const [arte, setArte] = useState<Arte>(ARTE);
  const [peca, setPeca] = useState<Peca>("nivel");
  const palco = useRef<HTMLDivElement>(null);
  const arrastando = useRef(false);

  function mover(e: React.PointerEvent) {
    if (!arrastando.current || !palco.current) return;
    const caixa = palco.current.getBoundingClientRect();
    // A caixa ja vem escalada, entao a divisao devolve percentual correto sem
    // que este componente saiba nada sobre a escala do palco.
    const x = Number(
      (((e.clientX - caixa.left) / caixa.width) * 100).toFixed(2),
    );
    const y = Number(
      (((e.clientY - caixa.top) / caixa.height) * 100).toFixed(2),
    );

    // Ramo explicito em vez de chave computada: `{ ...a, [peca]: ... }` perde o
    // tipo de `Arte` e o `npm run typecheck` reclama.
    setArte((a) =>
      peca === "nivel"
        ? { ...a, nivel: { ...a.nivel, x, y } }
        : { ...a, tempo: { ...a.tempo, x, y } },
    );
  }

  const saida = JSON.stringify(arte, null, 2).replace(/"([^"]+)":/g, "$1:");

  return (
    <div
      ref={palco}
      className="absolute inset-0 z-20"
      onPointerMove={mover}
      onPointerUp={() => (arrastando.current = false)}
      onPointerLeave={() => (arrastando.current = false)}
    >
      <div className="pointer-events-none absolute inset-0">
        {LINHAS.map((px) => (
          <div
            key={px}
            className="absolute left-0 w-full border-t border-cyan-400/30"
            style={{ top: px }}
          >
            <span className="ml-2 text-xl text-cyan-300/60">{px}</span>
          </div>
        ))}
        <div className="absolute left-1/2 top-0 h-full border-l border-cyan-400/30" />
      </div>

      {(["nivel", "tempo"] as const).map((nome) => (
        <div
          key={nome}
          onPointerDown={() => {
            setPeca(nome);
            arrastando.current = true;
          }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-xl border-4 px-6 py-3 text-2xl font-bold ${
            peca === nome
              ? "border-cyan-300 bg-cyan-400/40 text-white"
              : "border-white/30 bg-black/40 text-white/60"
          }`}
          style={{ left: `${arte[nome].x}%`, top: `${arte[nome].y}%` }}
        >
          {nome}
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-8 text-white">
        <p className="mb-4 text-3xl">
          Arraste cada peça para o lugar dela na arte. Editando:{" "}
          <b className="text-cyan-300">{peca}</b>
        </p>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(`export const ARTE: Arte = ${saida};`)
          }
          className="mb-6 rounded-2xl bg-cyan-500 px-8 py-5 text-3xl font-bold text-black"
        >
          copiar
        </button>
        <pre className="max-h-72 overflow-auto rounded-2xl bg-[#09090b] p-6 text-2xl text-cyan-200">
          {`export const ARTE: Arte = ${saida};`}
        </pre>
        <p className="mt-4 text-2xl text-white/50">
          Cole em lib/totem/arte.ts e recarregue.
        </p>
      </div>
    </div>
  );
}
