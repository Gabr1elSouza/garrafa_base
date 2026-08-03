/**
 * Onde cada peca do HUD cai sobre a arte. Tudo em percentual do palco de
 * 1080x1920, e nao em pixel: a arte pode ser reexportada em outra densidade sem
 * invalidar este arquivo.
 *
 * Trocada a arte, abra /totem?calibrar, arraste cada peca e cole aqui o que a
 * tela imprimir.
 */
export type Arte = {
  imagem: string;
  /** Barra de enchimento: centro e largura, ambos em percentual do palco. */
  nivel: { x: number; y: number; largura: number };
  /** Cronometro: centro e altura da fonte em percentual do palco. */
  tempo: { x: number; y: number; tamanho: number };
};

export const ARTE: Arte = {
  imagem: "/totem/cenario.svg",
  nivel: { x: 50, y: 88, largura: 60 },
  tempo: { x: 50, y: 8, tamanho: 5 },
};

function limitar(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.min(Math.max(valor, 0), 100);
}

/** Percentual do palco vira `left`/`top` prontos para o style inline. */
export function posicaoNoPalco(
  x: number,
  y: number,
): { left: string; top: string } {
  return { left: `${limitar(x)}%`, top: `${limitar(y)}%` };
}
