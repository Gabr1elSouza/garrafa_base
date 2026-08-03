import { oleo } from "./oleo";
import { redbull } from "./redbull";
import type { Recipiente, Tema } from "./tipos";

export type { PecaHud, Recipiente, Tema } from "./tipos";

export const TEMAS: Record<string, Tema> = { redbull, oleo };

export const TEMA_PADRAO = redbull;

/** Nome desconhecido cai no padrao em vez de quebrar a tela. */
export function resolverTema(nome?: string | null): Tema {
  if (!nome) return TEMA_PADRAO;
  return TEMAS[nome] ?? TEMA_PADRAO;
}

/**
 * Sorteia a imagem da partida. `sorteio` e injetavel para o teste nao depender
 * de Math.random.
 */
export function sortearLata(
  recipiente: Recipiente,
  sorteio: () => number = Math.random,
): string | null {
  if (recipiente.tipo !== "sprite") return null;
  const total = recipiente.imagens.length;
  // Math.random() nunca devolve 1, mas um sorteio injetado pode: sem o clamp o
  // indice sai da lista e a lata some.
  const i = Math.min(Math.floor(sorteio() * total), total - 1);
  return recipiente.imagens[i];
}
