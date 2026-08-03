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
import { criarAlca, criarCorpo, criarGargalo, criarTampa } from "./galao";
import { Lata } from "./Lata";
import { sortearLata, TEMA_PADRAO, type Recipiente } from "@/lib/temas";

/** Teto de gotas vivas. Acima disso o jato satura em vez de engasgar a cena. */
const MAX_GOTAS = 260;
const RAIO_GOTA = 0.055;
/** Inclinacao onde a garrafa aparece deitada de vez. */
const TILT_VISUAL_MAXIMO = 110;

/** Corpo da jarra, e por consequencia a largura do liquido dentro dela. */
const RAIO_CORPO_JARRA = ALVO_RAIO + 0.16;
const RAIO_LIQUIDO = RAIO_CORPO_JARRA - 0.05;

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
  /**
   * `estudio` fecha a cena com chao opaco e neblina. `aberto` deixa passar o
   * que estiver atras do canvas, mantendo so a sombra projetada.
   */
  ambiente?: "estudio" | "aberto";
  /** Sem tema explicito vale o padrao — e a rota `/` segue o padrao de graca. */
  recipiente?: Recipiente;
  liquido?: { cor: string; emissiva: string };
};

export function Cena({
  tilt,
  running,
  round,
  onProgress,
  ambiente = "estudio",
  recipiente = TEMA_PADRAO.recipiente,
  // Renomeado na desestruturacao: `liquido` ja e o ref do mesh do liquido
  // acumulado, logo abaixo.
  liquido: corDoLiquido = TEMA_PADRAO.liquido,
}: Props) {
  const geoCorpo = useMemo(() => criarCorpo(), []);
  const geoAlca = useMemo(() => criarAlca(), []);
  const geoGargalo = useMemo(() => criarGargalo(), []);
  const geoTampa = useMemo(() => criarTampa(), []);
  const geoAlvo = useGeometriaAlvo();

  // Uma lata por partida: `round` muda a cada rodada nova, entao o sorteio
  // acompanha sem precisar de estado proprio.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lata = useMemo(() => sortearLata(recipiente), [recipiente, round]);
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
      geoCorpo.dispose();
      geoAlca.dispose();
      geoGargalo.dispose();
      geoTampa.dispose();
      geoAlvo.dispose();
      geoGota.dispose();
    },
    [geoCorpo, geoAlca, geoGargalo, geoTampa, geoAlvo, geoGota],
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
          termina numa linha reta que denuncia o plano. No totem a arte e o
          fundo, e a neblina a taparia. */}
      {ambiente === "estudio" && (
        <fog attach="fog" args={["#09090b", 11, 26]} />
      )}

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 3, 4]} intensity={22} color="#7dd3fc" />

      {/* Recipiente de cima: o grupo fica na altura do bico e gira em torno
          dele. Nenhuma peca leva `position` — todas saem posicionadas com a
          boca na origem. */}
      <group ref={garrafa} position={[0, ALTURA_BOCAL, 0]}>
        {recipiente.tipo === "sprite" && lata ? (
          <Lata
            imagem={lata}
            largura={recipiente.largura}
            altura={recipiente.altura}
          />
        ) : (
          <>
            <mesh geometry={geoCorpo} castShadow>
              <meshStandardMaterial color="#d7d9d4" roughness={0.55} />
            </mesh>
            <mesh geometry={geoAlca} castShadow>
              <meshStandardMaterial color="#d7d9d4" roughness={0.55} />
            </mesh>
            <mesh geometry={geoGargalo} castShadow>
              <meshStandardMaterial color="#c9ccc6" roughness={0.6} />
            </mesh>
            {/* A tampa vermelha marca onde e o bico, que num galao fica no
                canto e nao no centro. */}
            <mesh geometry={geoTampa} castShadow>
              <meshStandardMaterial color="#b03a2e" roughness={0.45} />
            </mesh>
          </>
        )}
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
          color={corDoLiquido.cor}
          roughness={0.25}
          emissive={corDoLiquido.emissiva}
          emissiveIntensity={0.35}
        />
      </mesh>

      <instancedMesh
        ref={gotasMesh}
        args={[geoGota, undefined, MAX_GOTAS]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color={corDoLiquido.cor}
          roughness={0.2}
          emissive={corDoLiquido.emissiva}
          emissiveIntensity={0.3}
        />
      </instancedMesh>

      {/* Chao ao nivel da base da jarra. Bem maior que o enquadramento para
          que as bordas fiquem fora de vista e nao parecam uma laje solta. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        {ambiente === "estudio" ? (
          <meshStandardMaterial color="#131319" roughness={1} />
        ) : (
          // So a sombra sobrevive: e ela que ancora as garrafas no cenario.
          <shadowMaterial opacity={0.35} />
        )}
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
