"use client";

import { useRef, useState } from "react";
import type { Tema } from "@/lib/temas";

const LINHAS = Array.from({ length: 19 }, (_, i) => (i + 1) * 100);

type Peca = "pontos" | "tempo" | "nivel";

export function Calibrador({ tema }: { tema: Tema }) {
  const [hud, setHud] = useState(tema.hud);
  const [peca, setPeca] = useState<Peca>("tempo");
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

    // Ramo explicito em vez de chave computada: `{ ...h, [peca]: ... }` perde o
    // tipo e o `npm run typecheck` reclama.
    setHud((h) => {
      if (peca === "nivel") return { ...h, nivel: { ...h.nivel, x, y } };
      if (peca === "tempo") return { ...h, tempo: { ...h.tempo, x, y } };
      if (!h.pontos) return h;
      return { ...h, pontos: { ...h.pontos, x, y } };
    });
  }

  const disponiveis: Peca[] = hud.pontos
    ? ["pontos", "tempo", "nivel"]
    : ["tempo", "nivel"];

  const saida = JSON.stringify(hud, null, 2).replace(/"([^"]+)":/g, "$1:");

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

      {disponiveis.map((nome) => {
        const alvo = nome === "pontos" ? hud.pontos : hud[nome];
        if (!alvo) return null;
        return (
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
            style={{ left: `${alvo.x}%`, top: `${alvo.y}%` }}
          >
            {nome}
          </div>
        );
      })}

      <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-8 text-white">
        <p className="mb-4 text-3xl">
          Tema <b className="text-cyan-300">{tema.nome}</b> — arraste cada peça.
          Editando: <b className="text-cyan-300">{peca}</b>
        </p>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(`hud: ${saida},`)}
          className="mb-6 rounded-2xl bg-cyan-500 px-8 py-5 text-3xl font-bold text-black"
        >
          copiar
        </button>
        <pre className="max-h-72 overflow-auto rounded-2xl bg-[#09090b] p-6 text-2xl text-cyan-200">
          {`hud: ${saida},`}
        </pre>
        <p className="mt-4 text-2xl text-white/50">
          Cole em lib/temas/{tema.nome}.ts e recarregue.
        </p>
      </div>
    </div>
  );
}
