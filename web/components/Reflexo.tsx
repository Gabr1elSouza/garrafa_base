"use client";

import { useStore } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Props = {
  /**
   * Quanto do ambiente entra no metal. Ausente nao instala ambiente nenhum, e a
   * cena fica no vazio — que e o que a cena noturna do oleo quer.
   */
  intensidade?: number;
};

/**
 * Um estudio para a lata refletir.
 *
 * A lata e metal quase puro (metalness 1, roughness 0.1). Metal nao tem cor
 * propria sob luz difusa: ele mostra o que esta em volta. Numa cena sem
 * ambiente ele mostra o vazio, ou seja, preto — e e dai que vinha a lata
 * escura. Aumentar as luzes nao resolve: em metal, luz direcional so produz um
 * ponto de brilho especular, e ambiente quase nao afeta.
 *
 * `RoomEnvironment` ja vem no three: uma sala com paineis de luz, que passada
 * pelo PMREM vira exatamente o reflexo suave de uma foto de produto. Sem
 * dependencia nova, sem HDRI baixado, sem arquivo em `public`.
 *
 * Tudo nasce e morre dentro do efeito, de proposito. Criar o render target no
 * corpo do componente e descarta-lo no cleanup parece equivalente, mas em
 * StrictMode o efeito roda duas vezes e o descarte mata o target que ainda esta
 * instalado: sobra uma textura anexada e vazia, que ilumina nada e nao acusa
 * erro nenhum.
 */
export function Reflexo({ intensidade }: Props) {
  // O store, e nao `useThree`: escrever em `scene.environment` e mutacao, e o
  // que sai de `useThree` o React Compiler trata como imutavel.
  const store = useStore();

  useEffect(() => {
    if (intensidade === undefined) return;

    const { gl, scene } = store.getState();

    const pmrem = new THREE.PMREMGenerator(gl);
    const sala = new RoomEnvironment();
    const alvo = pmrem.fromScene(sala, 0.04);

    scene.environment = alvo.texture;
    scene.environmentIntensity = intensidade;

    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
      alvo.dispose();
      sala.dispose();
      pmrem.dispose();
    };
  }, [store, intensidade]);

  return null;
}
