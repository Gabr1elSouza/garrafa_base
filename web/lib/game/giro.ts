/**
 * Giro da lata em torno do proprio eixo.
 *
 * O firmware manda o angulo absoluto em 0..360 e ele da a volta. Amortecer
 * direto sobre esse numero faz o caminho longo: de 359 para 1 o valor percorre
 * 358 graus para tras, e a lata da um solavanco a cada volta.
 */

/**
 * Menor caminho de `de` ate `para`, em graus, no intervalo (-180, 180].
 *
 * A meia volta exata cai no positivo: os dois caminhos tem o mesmo comprimento,
 * e fixar um dos lados evita que a rotacao fique tremendo entre eles quando o
 * angulo passa raspando por 180.
 */
export function menorDiferencaAngular(de: number, para: number): number {
  if (!Number.isFinite(de) || !Number.isFinite(para)) return 0;

  // O resto de JS mantem o sinal do dividendo, entao somar 540 antes garante
  // que o valor caia em [0, 360) mesmo com entrada negativa ou acima de 360.
  // Subtrair 180 no fim recentra em [-180, 180).
  const delta = ((((para - de) % 360) + 540) % 360) - 180;
  return delta === -180 ? 180 : delta;
}
