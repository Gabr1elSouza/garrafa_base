"use client";

import type { Tema } from "@/lib/temas";

type Props = {
  tema: Tema;
  /** 0 a 1. */
  nivel: number;
};

/**
 * O liquido do copo que esta pintado na arte.
 *
 * Fica **atras** do `<img>` do fundo, e e por isso que funciona: o interior do
 * copo e a unica parte transparente da arte, entao ela mesma recorta esta
 * camada. O gelo e as paredes do copo continuam por cima, sem mascara nenhuma
 * e sem um segundo canvas.
 *
 * Por isso tambem nao ha largura: sobrar para os lados nao custa nada, porque
 * fora da janela a arte e opaca.
 */
export function LiquidoNaArte({ tema, nivel }: Props) {
  if (tema.deposito.onde !== "arte") return null;

  const { base, topo } = tema.deposito;
  const altura = (base - topo) * Math.min(Math.max(nivel, 0), 1);

  return (
    <div
      aria-hidden
      className="absolute inset-x-0"
      style={{
        // Ancorado no fundo do copo: cresce para cima conforme enche.
        bottom: `${100 - base}%`,
        height: `${altura}%`,
        // A borda de cima clareia um pouco para virar superficie em vez de
        // corte reto — atras de um vidro, e o quanto basta.
        background: `linear-gradient(to bottom, ${tema.liquido.cor} 0%, ${tema.liquido.emissiva} 100%)`,
        boxShadow: `inset 0 6px 18px -4px rgba(255,255,255,0.55)`,
      }}
    />
  );
}
