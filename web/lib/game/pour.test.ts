import { describe, expect, it } from "vitest";
import {
  aberturaDoJato,
  ALTURA_BOCAL,
  ALVO_RAIO,
  ALVO_Y,
  CHAO_Y,
  formatarTempo,
  GOTAS_PARA_ENCHER,
  gotasNoIntervalo,
  nascerGota,
  nivelDeEnchimento,
  passoGota,
  posicaoOscilador,
  precisao,
  TILT_MAXIMO,
  TILT_MINIMO,
  TRILHO_X,
  VELOCIDADE_TRILHO,
  velocidadeOscilador,
  type Gota,
  type ResultadoGota,
} from "./pour";

describe("oscilador da garrafa de cima", () => {
  it("comeca no centro", () => {
    expect(posicaoOscilador(0)).toBeCloseTo(0);
  });

  it("nunca sai do trilho", () => {
    for (let t = 0; t < 30; t += 0.01) {
      expect(Math.abs(posicaoOscilador(t))).toBeLessThanOrEqual(TRILHO_X + 1e-9);
    }
  });

  it("a velocidade acompanha a derivada da posicao", () => {
    const t = 1.3;
    const h = 1e-4;
    const derivada = (posicaoOscilador(t + h) - posicaoOscilador(t - h)) / (2 * h);
    expect(velocidadeOscilador(t)).toBeCloseTo(derivada, 3);
  });

  it("para nas pontas do trilho", () => {
    // No extremo do seno a velocidade passa por zero.
    let tExtremo = 0;
    for (let t = 0; t < 5; t += 0.001) {
      if (Math.abs(posicaoOscilador(t)) > Math.abs(posicaoOscilador(tExtremo))) {
        tExtremo = t;
      }
    }
    expect(Math.abs(velocidadeOscilador(tExtremo))).toBeLessThan(0.05);
  });
});

describe("aberturaDoJato", () => {
  it("fica fechado abaixo do limiar", () => {
    expect(aberturaDoJato(0)).toBe(0);
    expect(aberturaDoJato(TILT_MINIMO)).toBe(0);
    expect(aberturaDoJato(TILT_MINIMO - 5)).toBe(0);
  });

  it("abre gradualmente entre o minimo e o maximo", () => {
    const meio = (TILT_MINIMO + TILT_MAXIMO) / 2;
    expect(aberturaDoJato(meio)).toBeCloseTo(0.5, 2);
  });

  it("satura no maximo e nao passa disso", () => {
    expect(aberturaDoJato(TILT_MAXIMO)).toBe(1);
    expect(aberturaDoJato(180)).toBe(1);
  });

  it("cresce sem voltar atras", () => {
    let anterior = -1;
    for (let tilt = 0; tilt <= 180; tilt += 1) {
      const atual = aberturaDoJato(tilt);
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
  });

  it("nao gera gotas com o jato fechado", () => {
    expect(gotasNoIntervalo(TILT_MINIMO, 1)).toBe(0);
  });
});

describe("passoGota", () => {
  const parada = (x: number, y: number): Gota => ({ x, y, vx: 0, vy: 0 });

  it("acelera para baixo", () => {
    const { gota } = passoGota(parada(0, 3), 0.1);
    expect(gota.vy).toBeLessThan(0);
    expect(gota.y).toBeLessThan(3);
  });

  it("acerta quando cruza a boca dentro do raio", () => {
    const { resultado } = passoGota(parada(ALVO_RAIO * 0.5, ALVO_Y + 0.05), 0.1);
    expect(resultado).toBe("acertou");
  });

  it("erra quando cruza a boca fora do raio", () => {
    const { resultado } = passoGota(parada(ALVO_RAIO + 0.3, ALVO_Y + 0.05), 0.1);
    expect(resultado).not.toBe("acertou");
  });

  it("detecta acerto mesmo com passo grande que pularia o alvo", () => {
    // Gota rapida que, num unico passo, comeca acima e termina abaixo do alvo.
    const rapida: Gota = { x: 0, y: ALVO_Y + 2, vx: 0, vy: -12 };
    const { resultado } = passoGota(rapida, 0.5);
    expect(resultado).toBe("acertou");
  });

  it("usa a posicao no cruzamento, nao a final, para julgar", () => {
    // Entra pela boca mas continua andando de lado; ainda assim e acerto.
    const diagonal: Gota = { x: 0, y: ALVO_Y + 0.5, vx: 6, vy: -6 };
    const { resultado } = passoGota(diagonal, 0.2);
    expect(resultado).toBe("acertou");
  });

  it("perde a gota que passa do chao", () => {
    const { resultado } = passoGota({ x: 5, y: CHAO_Y + 0.01, vx: 0, vy: -1 }, 0.1);
    expect(resultado).toBe("perdeu");
  });

  it("mantem a gota voando enquanto esta no ar", () => {
    const { resultado } = passoGota(parada(0, ALTURA_BOCAL), 0.016);
    expect(resultado).toBe("voando");
  });

  /** Solta uma gota no instante `t` e diz onde ela terminou. */
  function simular(t: number): ResultadoGota {
    let gota = nascerGota(t);
    let resultado: ResultadoGota = "voando";
    for (let i = 0; i < 600 && resultado === "voando"; i++) {
      const passo = passoGota(gota, 1 / 120);
      gota = passo.gota;
      resultado = passo.resultado;
    }
    return resultado;
  }

  it("o jogo e vencivel: derramar no centro acerta o alvo", () => {
    // t=0 e a passagem pelo centro. E tambem o ponto de velocidade maxima do
    // vaivem, entao e aqui que a inercia do jato mais atrapalha.
    expect(simular(0)).toBe("acertou");
  });

  it("o jogo tem dificuldade: derramar nas pontas do trilho erra", () => {
    // Meio periodo ate o extremo do seno.
    const tExtremo = Math.PI / 2 / VELOCIDADE_TRILHO;
    expect(simular(tExtremo)).toBe("perdeu");
  });

  it("existe uma janela de acerto, nem sempre nem nunca", () => {
    const amostras = 400;
    const periodo = (2 * Math.PI) / VELOCIDADE_TRILHO;
    let acertos = 0;
    for (let i = 0; i < amostras; i++) {
      if (simular((i / amostras) * periodo) === "acertou") acertos++;
    }
    const fracao = acertos / amostras;
    expect(fracao).toBeGreaterThan(0.05);
    expect(fracao).toBeLessThan(0.5);
  });
});

describe("pontuacao", () => {
  it("enche proporcionalmente e satura em cheio", () => {
    expect(nivelDeEnchimento(0)).toBe(0);
    expect(nivelDeEnchimento(GOTAS_PARA_ENCHER / 2)).toBeCloseTo(0.5);
    expect(nivelDeEnchimento(GOTAS_PARA_ENCHER)).toBe(1);
    expect(nivelDeEnchimento(GOTAS_PARA_ENCHER * 3)).toBe(1);
  });

  it("precisao e zero antes da primeira gota", () => {
    expect(precisao(0, 0)).toBe(0);
  });

  it("precisao considera acertos sobre o total", () => {
    expect(precisao(3, 1)).toBeCloseTo(0.75);
    expect(precisao(10, 0)).toBe(1);
  });
});

describe("formatarTempo", () => {
  it("mostra segundos e centesimos", () => {
    expect(formatarTempo(0)).toBe("0.00s");
    expect(formatarTempo(3.456)).toBe("3.45s");
    expect(formatarTempo(12.5)).toBe("12.50s");
  });

  it("nao mostra tempo negativo", () => {
    expect(formatarTempo(-2)).toBe("0.00s");
  });
});
