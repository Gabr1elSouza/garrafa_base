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
