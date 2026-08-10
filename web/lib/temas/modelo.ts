/**
 * Encaixe de um `.glb` importado na cena.
 *
 * Um arquivo exportado do Sketchfab chega com altura em unidades arbitrarias e
 * o pivo onde o autor deixou. Os dois numeros aqui saem da bounding box medida
 * no proprio modelo, entao trocar o arquivo nao exige mexer em nada.
 */

/** Bounding box medida no modelo, em unidades do arquivo. */
export type Caixa = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export type Ajuste = {
  escala: number;
  offset: { x: number; y: number; z: number };
};

/**
 * Escala o modelo para `alturaAlvo` e move o pivo para a boca da lata.
 *
 * x e z ficam centrados porque o giro em torno do eixo longo acontece na
 * origem: um modelo fora do centro descreveria um cone em vez de girar parado.
 *
 * y encosta o **topo** na origem, porque e da boca que as gotas saem e e em
 * torno dela que a inclinacao gira. Centrar o y aqui, como faz a versao do
 * `redbull-giro-main`, poria o meio da lata no bico.
 */
export function ajusteDoModelo(caixa: Caixa, alturaAlvo: number): Ajuste {
  const altura = caixa.max.y - caixa.min.y;

  // Modelo degenerado devolve escala 1 em vez de Infinity: uma lata do tamanho
  // errado se enxerga na tela, uma lata escalada ao infinito some sem deixar
  // rastro no console.
  const escala = altura > 1e-9 ? alturaAlvo / altura : 1;

  return {
    escala,
    offset: {
      x: -((caixa.min.x + caixa.max.x) / 2) * escala,
      y: -caixa.max.y * escala,
      z: -((caixa.min.z + caixa.max.z) / 2) * escala,
    },
  };
}
