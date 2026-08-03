/**
 * Regras do jogo de derramar, em unidades de cena.
 *
 * A garrafa de cima desliza sozinha no eixo X. Inclinar a garrafa real abre o
 * jato. As gotas caem sob gravidade e valem ponto se cruzarem a boca da
 * garrafa de baixo.
 */

/** Metade do percurso da garrafa de cima. */
export const TRILHO_X = 2.2;
/** Altura do bico de onde as gotas saem. */
export const ALTURA_BOCAL = 4.0;
/** Velocidade angular do vaivem, em radianos por segundo. */
export const VELOCIDADE_TRILHO = 0.62;

/** Centro, altura da boca e raio da garrafa alvo. */
export const ALVO_X = 0;
export const ALVO_Y = 1.62;
export const ALVO_RAIO = 0.66;

/**
 * Altura do chão. A base da jarra apoia em y=0, então a gota morre logo abaixo
 * da superfície — some no instante em que encosta, sem atravessar o piso.
 */
export const CHAO_Y = -0.05;
export const GRAVIDADE = 9.8;

/** Inclinação onde o jato começa e onde atinge vazão máxima. */
export const TILT_MINIMO = 25;
export const TILT_MAXIMO = 95;
/** Gotas por segundo com o jato totalmente aberto. */
export const VAZAO_MAXIMA = 85;
/** Quantas gotas dentro do alvo enchem a garrafa. */
export const GOTAS_PARA_ENCHER = 130;

/**
 * Quanto da velocidade lateral da garrafa o jato leva junto.
 *
 * O alvo fica no centro, e é justamente no centro que o vaivém passa mais
 * rápido — nas pontas a garrafa para, mas ali está longe do alvo. Herança alta
 * empurraria toda gota para fora do raio do alvo em qualquer instante, e o jogo
 * ficaria impossível. Com 0.15 a gota desvia cerca de um terço do raio, o que
 * ainda exige adiantar o jato sem tornar o acerto inviável.
 */
export const INERCIA_JATO = 0.15;

export type Gota = { x: number; y: number; vx: number; vy: number };
export type ResultadoGota = "voando" | "acertou" | "perdeu";

/** Posição horizontal da garrafa de cima no instante `t` (segundos). */
export function posicaoOscilador(t: number): number {
  return Math.sin(t * VELOCIDADE_TRILHO) * TRILHO_X;
}

/** Velocidade horizontal da garrafa de cima, para o jato herdar inércia. */
export function velocidadeOscilador(t: number): number {
  return Math.cos(t * VELOCIDADE_TRILHO) * TRILHO_X * VELOCIDADE_TRILHO;
}

/**
 * Fração do jato aberto, de 0 a 1. Abaixo de `TILT_MINIMO` não sai nada, o que
 * evita que tremor de mão vire desperdício.
 */
export function aberturaDoJato(tilt: number): number {
  if (tilt <= TILT_MINIMO) return 0;
  const faixa = TILT_MAXIMO - TILT_MINIMO;
  return Math.min((tilt - TILT_MINIMO) / faixa, 1);
}

/** Quantas gotas nascem neste intervalo, dada a inclinação. */
export function gotasNoIntervalo(tilt: number, dt: number): number {
  return aberturaDoJato(tilt) * VAZAO_MAXIMA * dt;
}

/**
 * Avança uma gota e diz o que aconteceu com ela.
 *
 * A checagem de acerto é feita no cruzamento do plano da boca, não na posição
 * final: em passos grandes uma gota rápida pularia o alvo inteiro entre dois
 * quadros e o acerto seria perdido.
 */
export function passoGota(
  gota: Gota,
  dt: number,
): { gota: Gota; resultado: ResultadoGota } {
  const vy = gota.vy - GRAVIDADE * dt;
  const x = gota.x + gota.vx * dt;
  const y = gota.y + vy * dt;
  const proxima: Gota = { x, y, vx: gota.vx, vy };

  if (gota.y > ALVO_Y && y <= ALVO_Y) {
    const fracao = (gota.y - ALVO_Y) / (gota.y - y);
    const xNoCruzamento = gota.x + (x - gota.x) * fracao;
    if (Math.abs(xNoCruzamento - ALVO_X) <= ALVO_RAIO) {
      return { gota: proxima, resultado: "acertou" };
    }
  }

  if (y < CHAO_Y) return { gota: proxima, resultado: "perdeu" };
  return { gota: proxima, resultado: "voando" };
}

/** Gota recém-saída do bico, herdando o movimento lateral da garrafa. */
export function nascerGota(t: number): Gota {
  return {
    x: posicaoOscilador(t),
    y: ALTURA_BOCAL,
    vx: velocidadeOscilador(t) * INERCIA_JATO,
    vy: -0.5,
  };
}

/** Quanto a garrafa de baixo está cheia, de 0 a 1. */
export function nivelDeEnchimento(acertos: number): number {
  return Math.min(acertos / GOTAS_PARA_ENCHER, 1);
}

/** Fração do líquido que foi para dentro do alvo, de 0 a 1. */
export function precisao(acertos: number, perdidas: number): number {
  const total = acertos + perdidas;
  return total === 0 ? 0 : acertos / total;
}

export function formatarTempo(segundos: number): string {
  const s = Math.max(0, segundos);
  const inteiros = Math.floor(s);
  const centesimos = Math.floor((s - inteiros) * 100);
  return `${inteiros}.${String(centesimos).padStart(2, "0")}s`;
}
