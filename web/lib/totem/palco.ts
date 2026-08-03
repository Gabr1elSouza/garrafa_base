"use client";

import { useEffect, useState } from "react";

/** O palco tem tamanho fixo: toda coordenada do HUD e percentual dele. */
export const PALCO_L = 1080;
export const PALCO_A = 1920;

/**
 * Quanto o palco precisa encolher para caber na janela.
 *
 * Medida invalida devolve 1 em vez de 0: um palco escalado a zero desaparece
 * sem erro nenhum no console, e o sintoma nao aponta pra causa.
 */
export function escalaDoPalco(largura: number, altura: number): number {
  if (!Number.isFinite(largura) || !Number.isFinite(altura)) return 1;
  if (largura <= 0 || altura <= 0) return 1;
  return Math.min(largura / PALCO_L, altura / PALCO_A);
}

/**
 * CSS nao resolve isto sozinho: `scale()` exige numero sem unidade e `calc()`
 * nao divide comprimento por comprimento.
 */
export function usePalco(): number {
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    function medir() {
      setEscala(escalaDoPalco(window.innerWidth, window.innerHeight));
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  return escala;
}
