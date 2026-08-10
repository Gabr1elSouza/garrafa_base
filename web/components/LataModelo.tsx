"use client";

import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ajusteDoModelo } from "@/lib/temas/modelo";

type Props = {
  arquivo: string;
  altura: number;
};

/**
 * A lata do `.glb`, com a boca na origem e o eixo longo no Y.
 *
 * Ao contrario do `RedBullCan.tsx` do redbull-giro, nao ha rotacao de eixos
 * aqui: aquela versao converte para o referencial Z-up do sensor, e esta cena e
 * Y-up puro. O no raiz do arquivo ja carrega a matriz que poe a lata em pe.
 *
 * A escala e o pivo saem da bounding box medida no proprio modelo, entao trocar
 * o arquivo nao exige mexer em nenhum numero.
 *
 * Quem faz a lata parecer aluminio e o `Reflexo`, nao esta aqui: o corpo e
 * metal, e metal mostra o ambiente em vez de responder a luz direta.
 */
export function LataModelo({ arquivo, altura }: Props) {
  const gltf = useLoader(GLTFLoader, arquivo);

  const { objeto, escala, offset } = useMemo(() => {
    const objeto = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(objeto);
    const { escala, offset } = ajusteDoModelo(
      { min: { ...box.min }, max: { ...box.max } },
      altura,
    );
    return { objeto, escala, offset };
  }, [gltf, altura]);

  // O clone compartilha geometrias e materiais com a cena do cache do loader,
  // que sobrevive ao componente: descartar aqui apagaria a lata da proxima
  // montagem. So o proprio clone precisa sair da arvore, e isso o React faz.
  useEffect(() => {
    objeto.traverse((no) => {
      if (no instanceof THREE.Mesh) no.castShadow = true;
    });
  }, [objeto]);

  return (
    <primitive
      object={objeto}
      scale={escala}
      position={[offset.x, offset.y, offset.z]}
    />
  );
}
