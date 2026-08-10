"use client";

import { Canvas } from "@react-three/fiber";
import { Cena } from "@/components/PourScene";
import type { Tema } from "@/lib/temas";

type Props = {
  tilt: number;
  /** Giro em torno do proprio eixo, 0..360. */
  angle: number;
  running: boolean;
  round: number;
  onProgress: (acertos: number, perdidas: number) => void;
  tema: Tema;
};

/**
 * Enquadramento retrato.
 *
 * A area jogavel vai de x = ±2.6 e de y = 0 a y ~ 6. Num palco 9:16 com fov
 * vertical de 42°, a largura visivel e cerca de 0.43 x distancia, entao cobrir
 * 5.2 unidades exige a camera a uns 13.5 de distancia.
 */
export function CenaTotem(props: Props) {
  return (
    <Canvas
      className="absolute inset-0"
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true }}
      // O palco inteiro vive dentro de um `transform: scale()`, e a medida
      // padrao do R3F sai de `getBoundingClientRect`, que ja vem escalada. Ele
      // gravava esse tamanho em pixels no canvas e o transform do pai o
      // encolhia de novo, deixando a cena 3D num pedaco do palco enquanto a
      // arte ocupava tudo. `offsetSize` mede o layout, que ignora o transform.
      resize={{ offsetSize: true }}
      camera={{ position: [0, 3.2, 13.5], fov: 42 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 3.0, 0);
        // Sem isto o canvas pinta o proprio fundo e a arte some.
        gl.setClearAlpha(0);
      }}
    >
      <Cena
        tilt={props.tilt}
        angle={props.angle}
        running={props.running}
        round={props.round}
        onProgress={props.onProgress}
        ambiente="aberto"
        recipiente={props.tema.recipiente}
        liquido={props.tema.liquido}
        alvo={props.tema.alvo}
        deposito={props.tema.deposito}
        bocal={props.tema.bocal}
        luz={props.tema.luz}
      />
    </Canvas>
  );
}
