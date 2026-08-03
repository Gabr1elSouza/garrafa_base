"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  ALTURA_BOCAL,
  ALVO_RAIO,
  ALVO_Y,
  gotasNoIntervalo,
  nascerGota,
  nivelDeEnchimento,
  passoGota,
  posicaoOscilador,
  type Gota,
} from "@/lib/game/pour";

/** Teto de gotas vivas. Acima disso o jato satura em vez de engasgar a cena. */
const MAX_GOTAS = 260;
const RAIO_GOTA = 0.055;
/** Inclinacao onde a garrafa aparece deitada de vez. */
const TILT_VISUAL_MAXIMO = 110;

/** Corpo da jarra, e por consequencia a largura do liquido dentro dela. */
const RAIO_CORPO_JARRA = ALVO_RAIO + 0.16;
const RAIO_LIQUIDO = RAIO_CORPO_JARRA - 0.05;

/** Garrafa de despejar: bico na origem, corpo para baixo. */
function useGeometriaGarrafa() {
  return useMemo(() => {
    const perfil = [
      [0.0, 0.0],
      [0.34, 0.0],
      [0.36, 0.07],
      [0.36, 0.9],
      [0.35, 1.05],
      [0.24, 1.38],
      [0.14, 1.56],
      [0.132, 1.86],
      [0.155, 1.93],
      [0.155, 2.0],
      [0.0, 2.0],
    ].map(([x, y]) => new THREE.Vector2(x, y));

    const g = new THREE.LatheGeometry(perfil, 40);
    // Bico na origem para que o giro aconteca em torno da boca, como acontece
    // ao virar uma garrafa de verdade.
    g.translate(0, -2.0, 0);
    return g;
  }, []);
}

/** Alvo: jarra de boca larga, para que o raio de acerto seja crivel. */
function useGeometriaAlvo() {
  return useMemo(() => {
    // O corpo tem que ser mais largo que a boca, senao a jarra fica com a
    // silhueta invertida quando o raio do alvo cresce.
    const corpo = RAIO_CORPO_JARRA;
    const perfil = [
      [0.0, 0.0],
      [corpo - 0.02, 0.0],
      [corpo, 0.08],
      [corpo, 0.95],
      [corpo - 0.06, 1.25],
      [ALVO_RAIO, 1.5],
      [ALVO_RAIO, ALVO_Y],
      [0.0, ALVO_Y],
    ].map(([x, y]) => new THREE.Vector2(x, y));

    return new THREE.LatheGeometry(perfil, 40);
  }, []);
}

type Props = {
  tilt: number;
  running: boolean;
  /** Muda para pedir uma partida nova. */
  round: number;
  onProgress: (acertos: number, perdidas: number) => void;
};

function Cena({ tilt, running, round, onProgress }: Props) {
  const geoGarrafa = useGeometriaGarrafa();
  const geoAlvo = useGeometriaAlvo();
  const geoGota = useMemo(
    () => new THREE.SphereGeometry(RAIO_GOTA, 8, 6),
    [],
  );

  const garrafa = useRef<THREE.Group>(null);
  const gotasMesh = useRef<THREE.InstancedMesh>(null);
  const liquido = useRef<THREE.Mesh>(null);

  const gotas = useRef<Gota[]>([]);
  const sobra = useRef(0);
  const tempo = useRef(0);
  const acertos = useRef(0);
  const perdidas = useRef(0);
  const desdeAviso = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(
    () => () => {
      geoGarrafa.dispose();
      geoAlvo.dispose();
      geoGota.dispose();
    },
    [geoGarrafa, geoAlvo, geoGota],
  );

  // Partida nova zera tudo.
  useEffect(() => {
    gotas.current = [];
    sobra.current = 0;
    tempo.current = 0;
    acertos.current = 0;
    perdidas.current = 0;
  }, [round]);

  useFrame((_, dtBruto) => {
    // Aba em segundo plano devolve dt enorme; limitar evita que a fisica
    // teleporte todas as gotas de uma vez.
    const dt = Math.min(dtBruto, 1 / 30);

    if (running) tempo.current += dt;
    const t = tempo.current;

    // --- garrafa de cima ---
    if (garrafa.current) {
      garrafa.current.position.x = posicaoOscilador(t);
      const grausVisuais = Math.min(tilt, TILT_VISUAL_MAXIMO);
      garrafa.current.rotation.z = THREE.MathUtils.damp(
        garrafa.current.rotation.z,
        THREE.MathUtils.degToRad(grausVisuais),
        18,
        dt,
      );
    }

    // --- nascimento de gotas ---
    if (running) {
      sobra.current += gotasNoIntervalo(tilt, dt);
      while (sobra.current >= 1 && gotas.current.length < MAX_GOTAS) {
        sobra.current -= 1;
        gotas.current.push(nascerGota(t));
      }
      // Jato fechado nao acumula credito para uma rajada depois.
      if (sobra.current > 1) sobra.current = 1;
    }

    // --- fisica ---
    const vivas: Gota[] = [];
    for (const gota of gotas.current) {
      const passo = passoGota(gota, dt);
      if (passo.resultado === "acertou") acertos.current += 1;
      else if (passo.resultado === "perdeu") perdidas.current += 1;
      else vivas.push(passo.gota);
    }
    gotas.current = vivas;

    // --- desenho das gotas ---
    if (gotasMesh.current) {
      for (let i = 0; i < vivas.length; i++) {
        dummy.position.set(vivas[i].x, vivas[i].y, 0);
        dummy.updateMatrix();
        gotasMesh.current.setMatrixAt(i, dummy.matrix);
      }
      gotasMesh.current.count = vivas.length;
      gotasMesh.current.instanceMatrix.needsUpdate = true;
    }

    // --- nivel dentro da jarra ---
    if (liquido.current) {
      const nivel = nivelDeEnchimento(acertos.current);
      const altura = Math.max(nivel * 1.32, 0.001);
      liquido.current.scale.y = altura;
      liquido.current.position.y = 0.08 + altura / 2;
      liquido.current.visible = nivel > 0;
    }

    // --- avisa o placar a 10 Hz ---
    desdeAviso.current += dt;
    if (desdeAviso.current >= 0.1) {
      desdeAviso.current = 0;
      onProgress(acertos.current, perdidas.current);
    }
  });

  return (
    <>
      {/* Dissolve a borda distante do chao no fundo da pagina, senao o piso
          termina numa linha reta que denuncia o plano. */}
      <fog attach="fog" args={["#09090b", 11, 26]} />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 3, 4]} intensity={22} color="#7dd3fc" />

      {/* Garrafa de cima: o grupo fica na altura do bico e gira em torno dele. */}
      <group ref={garrafa} position={[0, ALTURA_BOCAL, 0]}>
        <mesh geometry={geoGarrafa} castShadow>
          <meshPhysicalMaterial
            color="#2f6b3a"
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.9}
          />
        </mesh>
      </group>

      {/* Jarra alvo, parada no centro. */}
      <mesh geometry={geoAlvo} position={[0, 0, 0]} receiveShadow>
        <meshPhysicalMaterial
          color="#9fb8c4"
          roughness={0.08}
          clearcoat={1}
          transmission={0.55}
          thickness={0.4}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Liquido acumulado. Escala em Y cresce conforme enche. O raio segue o
          corpo da jarra, senao sobra um vao e o liquido parece uma lata solta
          la dentro. */}
      <mesh ref={liquido} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[RAIO_LIQUIDO, RAIO_LIQUIDO, 1, 32]} />
        <meshStandardMaterial
          color="#e8a33a"
          roughness={0.25}
          emissive="#7a4d05"
          emissiveIntensity={0.35}
        />
      </mesh>

      <instancedMesh
        ref={gotasMesh}
        args={[geoGota, undefined, MAX_GOTAS]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#f0b429"
          roughness={0.2}
          emissive="#8a5a08"
          emissiveIntensity={0.3}
        />
      </instancedMesh>

      {/* Chao ao nivel da base da jarra. Bem maior que o enquadramento para
          que as bordas fiquem fora de vista e nao parecam uma laje solta. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#131319" roughness={1} />
      </mesh>
    </>
  );
}

export function PourScene(props: Props) {
  return (
    <div className="relative aspect-[4/3] w-full max-w-[52rem]">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 3.0, 10.2], fov: 42 }}
        onCreated={({ camera }) => camera.lookAt(0, 2.2, 0)}
      >
        <Cena {...props} />
      </Canvas>
    </div>
  );
}
