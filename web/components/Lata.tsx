"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

type Props = {
  imagem: string;
  largura: number;
  altura: number;
};

/**
 * A lata e uma foto, nao um modelo.
 *
 * Funciona porque a camera e frontal e o despejo gira em `rotation.z`: girar um
 * plano no plano da tela e indistinguivel de inclinar uma lata. So quebraria se
 * a camera orbitasse, e ela nao orbita.
 */
export function Lata({ imagem, largura, altura }: Props) {
  // Carrega a propria textura em vez de usar `useLoader`: a textura do cache
  // compartilhado nao pode ser modificada, e sem ajustar o colorSpace a PNG
  // aparece lavada — sintoma que parece "a arte veio errada" em vez de "faltou
  // uma linha".
  const textura = useMemo(() => {
    const t = new THREE.TextureLoader().load(imagem);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [imagem]);

  useEffect(() => () => textura.dispose(), [textura]);

  return (
    // A boca fica na origem do grupo: o plano pendura inteiro abaixo dela.
    <mesh position={[0, -altura / 2, 0]} castShadow>
      <planeGeometry args={[largura, altura]} />
      {/* `basic` e nao `standard`: a foto ja tem luz e sombra embutidas, e
          ilumina-la de novo suja o produto. `alphaTest` faz a sombra seguir o
          contorno da lata em vez de virar o retangulo do plano. */}
      <meshBasicMaterial
        map={textura}
        transparent
        alphaTest={0.5}
        toneMapped={false}
      />
    </mesh>
  );
}
