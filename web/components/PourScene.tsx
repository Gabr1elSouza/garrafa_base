"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  ALVO_JARRA,
  gotasNoIntervalo,
  nascerGota,
  nivelDeEnchimento,
  passoGota,
  posicaoOscilador,
  type Alvo,
  type Gota,
} from "@/lib/game/pour";
import { menorDiferencaAngular } from "@/lib/game/giro";
import { criarAlca, criarCorpo, criarGargalo, criarTampa } from "./galao";
import { LataModelo } from "./LataModelo";
import { Reflexo } from "./Reflexo";
import { TEMA_PADRAO, type Deposito, type Luz, type Recipiente } from "@/lib/temas";

/** Liquido dentro da jarra procedural. Vale para a rota `/`, sem tema. */
const DEPOSITO_JARRA: Deposito = {
  onde: "cena",
  fundo: 0.08,
  raio: 0.77,
  altura: 1.32,
};

/** Luz de estudio: a cena fechada e escura da rota `/`. */
const LUZ_ESTUDIO: Luz = {
  ambiente: 0.6,
  principal: 2.4,
  preenchimento: { posicao: [-5, 3, 4], intensidade: 22, cor: "#7dd3fc" },
};

/** Teto de gotas vivas. Acima disso o jato satura em vez de engasgar a cena. */
const MAX_GOTAS = 260;
const RAIO_GOTA = 0.055;
/** Inclinacao onde a garrafa aparece deitada de vez. */
const TILT_VISUAL_MAXIMO = 110;

/**
 * Constante de suavizacao do giro, em 1/s.
 *
 * O firmware cai para 4 Hz quando a lata esta quase parada, entao amortecer e o
 * que separa um giro lento de uma sequencia de degraus. Alta demais e o
 * amortecimento some; baixa demais e a lata fica arrastando atras da mao.
 */
const SUAVIZACAO_GIRO = 14;

/** Alvo: jarra de boca larga, para que o raio de acerto seja crivel. */
function useGeometriaAlvo(alvo: Alvo) {
  return useMemo(() => {
    // O corpo tem que ser mais largo que a boca, senao a jarra fica com a
    // silhueta invertida quando o raio do alvo cresce.
    const corpo = alvo.raio + 0.16;
    const perfil = [
      [0.0, 0.0],
      [corpo - 0.02, 0.0],
      [corpo, 0.08],
      [corpo, 0.95],
      [corpo - 0.06, 1.25],
      [alvo.raio, 1.5],
      [alvo.raio, alvo.y],
      [0.0, alvo.y],
    ].map(([x, y]) => new THREE.Vector2(x, y));

    return new THREE.LatheGeometry(perfil, 40);
  }, [alvo]);
}

type Props = {
  tilt: number;
  /**
   * Giro em torno do proprio eixo, 0..360. Puramente visual: nao move a lata
   * nem influi na pontuacao.
   */
  angle?: number;
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
  /**
   * Onde as gotas caem. O padrao e a jarra procedural, e nao o alvo do tema
   * padrao: a rota `/` e uma cena de estudio fechada em si mesma, sem arte de
   * fundo onde um copo pintado pudesse existir.
   */
  alvo?: Alvo;
  /**
   * Onde o liquido acumulado mora. `arte` significa que o recipiente esta
   * pintado no fundo e o liquido e desenhado fora daqui, atras da arte — a cena
   * entao nao desenha nem a jarra nem o cilindro.
   */
  deposito?: Deposito;
  /** Altura do bico. Sobe junto com recipientes mais altos. */
  bocal?: number;
  luz?: Luz;
};

export function Cena({
  tilt,
  angle = 0,
  running,
  round,
  onProgress,
  ambiente = "estudio",
  recipiente = TEMA_PADRAO.recipiente,
  // Renomeado na desestruturacao: `liquido` ja e o ref do mesh do liquido
  // acumulado, logo abaixo.
  liquido: corDoLiquido = TEMA_PADRAO.liquido,
  alvo = ALVO_JARRA,
  deposito = DEPOSITO_JARRA,
  // O bico sai do mesmo tema que o recipiente, nunca de uma constante solta: os
  // dois formam um par, e separa-los afunda a lata dentro da jarra.
  bocal = TEMA_PADRAO.bocal,
  luz = LUZ_ESTUDIO,
}: Props) {
  const naCena = deposito.onde === "cena" ? deposito : null;
  const geoCorpo = useMemo(() => criarCorpo(), []);
  const geoAlca = useMemo(() => criarAlca(), []);
  const geoGargalo = useMemo(() => criarGargalo(), []);
  const geoTampa = useMemo(() => criarTampa(), []);
  const geoAlvo = useGeometriaAlvo(alvo);

  const geoGota = useMemo(
    () => new THREE.SphereGeometry(RAIO_GOTA, 8, 6),
    [],
  );

  const garrafa = useRef<THREE.Group>(null);
  const giro = useRef<THREE.Group>(null);
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

    // --- giro no proprio eixo ---
    // Grupo separado e interno ao da inclinacao: assim o giro acontece no
    // referencial local da lata e ela continua girando em torno do eixo longo
    // mesmo ja deitada. No grupo de fora, inclinar a faria orbitar.
    if (giro.current) {
      const atual = THREE.MathUtils.radToDeg(giro.current.rotation.y);
      // Amortece sobre o menor caminho, nunca sobre a diferenca crua: o angulo
      // da a volta em 360 e o caminho longo apareceria como um solavanco.
      const delta = menorDiferencaAngular(atual, angle);
      giro.current.rotation.y += THREE.MathUtils.degToRad(
        delta * (1 - Math.exp(-SUAVIZACAO_GIRO * dt)),
      );
    }

    // --- nascimento de gotas ---
    if (running) {
      sobra.current += gotasNoIntervalo(tilt, dt);
      while (sobra.current >= 1 && gotas.current.length < MAX_GOTAS) {
        sobra.current -= 1;
        gotas.current.push(nascerGota(t, bocal));
      }
      // Jato fechado nao acumula credito para uma rajada depois.
      if (sobra.current > 1) sobra.current = 1;
    }

    // --- fisica ---
    const vivas: Gota[] = [];
    for (const gota of gotas.current) {
      const passo = passoGota(gota, dt, alvo);
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
    // So quando o liquido e desta cena: no tema com copo pintado quem desenha o
    // nivel e a camada atras da arte.
    if (liquido.current && naCena) {
      const nivel = nivelDeEnchimento(acertos.current);
      const altura = Math.max(nivel * naCena.altura, 0.001);
      liquido.current.scale.y = altura;
      liquido.current.position.y = naCena.fundo + altura / 2;
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

      <Reflexo intensidade={luz.reflexo} />

      <ambientLight intensity={luz.ambiente} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={luz.principal}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight
        position={luz.preenchimento.posicao}
        intensity={luz.preenchimento.intensidade}
        color={luz.preenchimento.cor}
      />

      {/* Recipiente de cima: o grupo fica na altura do bico e gira em torno
          dele. Nenhuma peca leva `position` — todas saem posicionadas com a
          boca na origem. */}
      <group ref={garrafa} position={[0, bocal, 0]}>
        {recipiente.tipo === "modelo" ? (
          // O grupo do giro fica aqui dentro, e nao em volta: girar no
          // referencial local mantem a lata rodando no proprio eixo mesmo
          // inclinada.
          <group ref={giro}>
            {/* O .glb tem 6 MB: ate chegar, a cena fica sem a lata em vez de
                piscar um modelo provisorio que some. */}
            <Suspense fallback={null}>
              <LataModelo
                arquivo={recipiente.arquivo}
                altura={recipiente.altura}
              />
            </Suspense>
          </group>
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

      {/* Jarra alvo e o liquido dentro dela. Ausentes quando o recipiente ja
          vem pintado na arte: desenhar a jarra ali poria dois recipientes na
          tela, e o cilindro passaria por cima do gelo em vez de aparecer
          dentro do copo. */}
      {naCena && (
        <>
          <mesh
            geometry={geoAlvo}
            position={[alvo.x, alvo.chao, 0]}
            receiveShadow
          >
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

          {/* Escala em Y cresce conforme enche. O raio segue o corpo da jarra,
              senao sobra um vao e o liquido parece uma lata solta la dentro. */}
          <mesh ref={liquido} position={[alvo.x, naCena.fundo, 0]}>
            <cylinderGeometry args={[naCena.raio, naCena.raio, 1, 32]} />
            <meshStandardMaterial
              color={corDoLiquido.cor}
              roughness={0.25}
              emissive={corDoLiquido.emissiva}
              emissiveIntensity={0.35}
            />
          </mesh>
        </>
      )}

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
          // O ambiente e forte porque a lata e metal e precisa dele. Gota nao
          // e: no mesmo nivel o jato lava e sai creme, destoando do liquido
          // ambar que se acumula no copo.
          envMapIntensity={0.35}
        />
      </instancedMesh>

      {/* Chao ao nivel da base do recipiente. Bem maior que o enquadramento
          para que as bordas fiquem fora de vista e nao parecam uma laje solta.

          So existe quando a cena e dona do recipiente. Com o recipiente vindo
          da arte nao ha superficie 3D nenhuma para receber sombra: a arte e uma
          foto plana, com luz e sombra proprias, e a sombra projetada da lata
          caia como uma mancha solta em cima do copo. */}
      {naCena && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, alvo.chao, 0]}
          receiveShadow
        >
          <planeGeometry args={[80, 60]} />
          {ambiente === "estudio" ? (
            <meshStandardMaterial color="#131319" roughness={1} />
          ) : (
            // So a sombra sobrevive: e ela que ancora as garrafas no cenario.
            <shadowMaterial opacity={0.35} />
          )}
        </mesh>
      )}
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
