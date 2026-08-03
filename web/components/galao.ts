import * as THREE from "three";

/**
 * Galao de oleo tipo "F", em unidades de cena.
 *
 * Todas as geometrias saem posicionadas no sistema de coordenadas do bico:
 * a boca fica em (0, 0, 0), o corpo pendura abaixo e a esquerda. E o bico que
 * precisa estar na origem porque a peca gira em torno dele ao inclinar e e de
 * la que as gotas nascem.
 */
export const GALAO = {
  corpo: {
    largura: 1.0,
    altura: 1.5,
    profundidade: 0.5,
    canto: 0.12,
    centroX: -0.33,
    centroY: -1.11,
  },
  alca: {
    largura: 0.42,
    altura: 0.62,
    furoLargura: 0.2,
    furoAltura: 0.38,
    profundidade: 0.3,
    centroX: -0.9,
    centroY: -0.85,
  },
  gargalo: { raio: 0.13, altura: 0.28, centroY: -0.22 },
  tampa: { raio: 0.16, altura: 0.08, centroY: -0.04 },
};

/** Oleo de motor usado. Escurecer ou clarear se mexe so aqui. */
export const COR_OLEO = "#3a2410";
/**
 * Emissiva baixa de proposito: nao e para clarear a cor, e para a gota nao
 * virar silhueta chapada e sumir contra o fundo escuro.
 */
export const COR_OLEO_EMISSIVA = "#140b03";

const BISEL = 0.04;

/** Retangulo de cantos arredondados, centrado na origem do plano XY. */
function retanguloArredondado(
  largura: number,
  altura: number,
  raio: number,
): THREE.Shape {
  const forma = new THREE.Shape();
  const x = -largura / 2;
  const y = -altura / 2;

  forma.moveTo(x + raio, y);
  forma.lineTo(x + largura - raio, y);
  forma.quadraticCurveTo(x + largura, y, x + largura, y + raio);
  forma.lineTo(x + largura, y + altura - raio);
  forma.quadraticCurveTo(
    x + largura,
    y + altura,
    x + largura - raio,
    y + altura,
  );
  forma.lineTo(x + raio, y + altura);
  forma.quadraticCurveTo(x, y + altura, x, y + altura - raio);
  forma.lineTo(x, y + raio);
  forma.quadraticCurveTo(x, y, x + raio, y);

  return forma;
}

/**
 * Extruda uma forma centrada na profundidade pedida.
 *
 * Duas correcoes que o ExtrudeGeometry exige e que passam despercebidas: o
 * bisel cresce para fora nos dois lados, entao a extrusao desconta o dobro
 * dele; e a peca resultante vai de -bisel ate espessura+bisel, cujo centro e
 * `espessura/2` — nao `profundidade/2`. Centrar pelo numero errado deixa a peca
 * torta em Z por uma fracao que ninguem enxerga mas que desalinha o conjunto.
 */
function extrudar(forma: THREE.Shape, profundidade: number) {
  const espessura = Math.max(profundidade - BISEL * 2, 0.01);
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: espessura,
    bevelEnabled: true,
    bevelThickness: BISEL,
    bevelSize: BISEL,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -espessura / 2);
  return geo;
}

export function criarCorpo(): THREE.ExtrudeGeometry {
  const { largura, altura, profundidade, canto, centroX, centroY } =
    GALAO.corpo;
  const geo = extrudar(
    retanguloArredondado(largura - BISEL * 2, altura - BISEL * 2, canto),
    profundidade,
  );
  geo.translate(centroX, centroY, 0);
  return geo;
}

export function criarAlca(): THREE.ExtrudeGeometry {
  const {
    largura,
    altura,
    furoLargura,
    furoAltura,
    profundidade,
    centroX,
    centroY,
  } = GALAO.alca;

  const forma = retanguloArredondado(
    largura - BISEL * 2,
    altura - BISEL * 2,
    0.1,
  );
  forma.holes.push(retanguloArredondado(furoLargura, furoAltura, 0.06));

  const geo = extrudar(forma, profundidade);
  geo.translate(centroX, centroY, 0);
  return geo;
}

export function criarGargalo(): THREE.CylinderGeometry {
  const { raio, altura, centroY } = GALAO.gargalo;
  const geo = new THREE.CylinderGeometry(raio, raio * 1.15, altura, 24);
  geo.translate(0, centroY, 0);
  return geo;
}

export function criarTampa(): THREE.CylinderGeometry {
  const { raio, altura, centroY } = GALAO.tampa;
  const geo = new THREE.CylinderGeometry(raio, raio, altura, 24);
  geo.translate(0, centroY, 0);
  return geo;
}
