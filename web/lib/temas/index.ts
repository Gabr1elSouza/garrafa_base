import { oleo } from "./oleo";
import { redbull } from "./redbull";
import type { Tema } from "./tipos";

export type { Deposito, Luz, PecaHud, Recipiente, Tema } from "./tipos";
export { ajusteDoModelo, type Ajuste, type Caixa } from "./modelo";

export const TEMAS: Record<string, Tema> = { redbull, oleo };

export const TEMA_PADRAO = redbull;

/** Nome desconhecido cai no padrao em vez de quebrar a tela. */
export function resolverTema(nome?: string | null): Tema {
  if (!nome) return TEMA_PADRAO;
  return TEMAS[nome] ?? TEMA_PADRAO;
}
