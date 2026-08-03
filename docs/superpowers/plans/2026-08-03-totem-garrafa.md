# Totem 1080×1920 — Encha a Jarra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a rota `/totem`, um painel vertical de 1080×1920 onde o jogo de derramar roda sobre uma arte de fundo, com HUD mínimo e reinício automático entre jogadores.

**Architecture:** Um palco de 1080×1920 px fixos escalado por `transform: scale()`. Dentro dele, três camadas: a arte como `<img>`, um `<Canvas>` transparente em enquadramento retrato, e o HUD em HTML. A cena 3D existente é reaproveitada extraindo `Cena` de `PourScene.tsx` e parametrizando o cenário; a física em `lib/game/pour.ts` não muda.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), React 19.2, TypeScript, Tailwind v4, three.js + @react-three/fiber, vitest.

## Global Constraints

- **`web/AGENTS.md` manda ler `node_modules/next/dist/docs/` antes de escrever código.** Já lido para este plano: o que afeta o trabalho é (a) Turbopack é o padrão, (b) `next dev` grava em `.next/dev`, separado do `next build`, (c) `searchParams` em `page.tsx` virou assíncrono — este plano lê `window.location.search` no cliente e não usa `searchParams`.
- **Palco fixo:** 1080 × 1920 px. Toda coordenada do HUD é percentual desse palco.
- **Não modificar:** `web/app/page.tsx`, `web/lib/game/pour.ts`, `web/lib/spin-source/**`, `web/components/StatusBar.tsx`, `web/app/globals.css`, `web/app/layout.tsx`, o firmware ou o contrato BLE.
- **Única exceção:** `web/components/PourScene.tsx`, e só para exportar `Cena` e aceitar a prop `ambiente`. O comportamento padrão fica idêntico e `/` não pode mudar de aparência.
- **Tailwind já é global** neste projeto (`@import "tailwindcss"` em `globals.css`). Não criar CSS novo nem importar Tailwind de novo.
- **Idioma:** interface, nomes e comentários em português, seguindo o repositório. Comentários só onde explicam *por quê*.
- **Sem abstração além do necessário.** Nada de mira, ranking, som ou persistência.
- **Chrome/Edge, `localhost` apenas** — restrição do Web Bluetooth, herdada.
- Todo comando roda em `web/`, não na raiz do repositório.

---

### Task 1: Fundação — git, palco escalado e a rota

Entrega: `/totem` abre com o palco de 1080×1920 escalado para caber na janela, e `npm test` continua verde.

**Files:**
- Create: `web/lib/totem/palco.ts`
- Test: `web/lib/totem/palco.test.ts`
- Create: `web/app/totem/page.tsx`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `PALCO_L = 1080`, `PALCO_A = 1920`
  - `escalaDoPalco(largura: number, altura: number): number`
  - `usePalco(): number`

- [ ] **Step 1: Inicializar o git e criar o branch**

O repositório ainda não é um repositório git, e este plano commita a cada task.

```bash
cd "C:/Users/sukat/OneDrive/Desktop/Gabriel Codes/garrafa-main/garrafa-main"
git init
git add -A
git commit -m "chore: estado inicial do jogo da garrafa"
git checkout -b totem-garrafa
```

- [ ] **Step 2: Confirmar a suíte de partida**

```bash
cd web
npm test
```
Expected: PASS. Anote o número de testes — ele é a linha de base para as próximas tasks.

- [ ] **Step 3: Escrever o teste que falha**

Create `web/lib/totem/palco.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { escalaDoPalco } from "./palco";

describe("escalaDoPalco", () => {
  it("da 1 no painel de 1080x1920 exatos", () => {
    expect(escalaDoPalco(1080, 1920)).toBe(1);
  });

  it("limita pela altura quando a janela e larga demais", () => {
    // 3000/1080 = 2.77 de folga na largura; a altura e quem aperta.
    expect(escalaDoPalco(3000, 960)).toBeCloseTo(0.5);
  });

  it("limita pela largura quando a janela e alta demais", () => {
    expect(escalaDoPalco(540, 3000)).toBeCloseTo(0.5);
  });

  it("nunca devolve zero ou negativo com medidas invalidas", () => {
    expect(escalaDoPalco(0, 0)).toBe(1);
    expect(escalaDoPalco(-100, 500)).toBe(1);
    expect(escalaDoPalco(Number.NaN, 1920)).toBe(1);
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falha**

```bash
npx vitest run lib/totem/palco.test.ts
```
Expected: FAIL — `Cannot find module './palco'`.

- [ ] **Step 5: Implementar `web/lib/totem/palco.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

/** O palco tem tamanho fixo: toda coordenada do HUD e percentual dele. */
export const PALCO_L = 1080;
export const PALCO_A = 1920;

/**
 * Quanto o palco precisa encolher para caber na janela.
 *
 * Medida invalida devolve 1 em vez de 0: um palco escalado a zero desaparece
 * sem erro nenhum no console, e o sintoma nao aponta pra causa.
 */
export function escalaDoPalco(largura: number, altura: number): number {
  if (!Number.isFinite(largura) || !Number.isFinite(altura)) return 1;
  if (largura <= 0 || altura <= 0) return 1;
  return Math.min(largura / PALCO_L, altura / PALCO_A);
}

/**
 * CSS nao resolve isto sozinho: `scale()` exige numero sem unidade e `calc()`
 * nao divide comprimento por comprimento.
 */
export function usePalco(): number {
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    function medir() {
      setEscala(escalaDoPalco(window.innerWidth, window.innerHeight));
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  return escala;
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

```bash
npx vitest run lib/totem/palco.test.ts
```
Expected: PASS, 4 testes.

- [ ] **Step 7: Criar `web/app/totem/page.tsx` com o palco de prova**

```tsx
"use client";

import { PALCO_A, PALCO_L, usePalco } from "@/lib/totem/palco";

export default function Totem() {
  const escala = usePalco();

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-1/2 origin-center overflow-hidden bg-[#09090b]"
        style={{
          width: PALCO_L,
          height: PALCO_A,
          transform: `translate(-50%, -50%) scale(${escala})`,
        }}
      >
        <div className="absolute inset-8 rounded-3xl border-4 border-dashed border-white/20" />
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Verificar no navegador**

```bash
npm run dev
```
Abra `http://localhost:3000/totem`. Esperado: retângulo tracejado num palco vertical centralizado, encolhendo e crescendo com a janela, sempre na proporção 1080:1920.

Abra também `http://localhost:3000/` e confirme que o jogo original está intacto.

- [ ] **Step 9: Typecheck, testes e commit**

```bash
npm run typecheck
npm test
cd ..
git add web/lib/totem web/app/totem
git commit -m "feat(totem): palco fixo de 1080x1920 escalado"
```

---

### Task 2: Arte de fundo e coordenadas

Entrega: a arte placeholder preenche o palco e as coordenadas do HUD existem, tipadas e testadas.

**Files:**
- Create: `web/public/totem/cenario.svg`
- Create: `web/lib/totem/arte.ts`
- Test: `web/lib/totem/arte.test.ts`
- Modify: `web/app/totem/page.tsx`

**Interfaces:**
- Consumes: `PALCO_L`, `PALCO_A`, `usePalco` (Task 1).
- Produces:
  - `ARTE` — `{ imagem: string; nivel: { x, y, largura }; tempo: { x, y, tamanho } }`
  - `posicaoNoPalco(x: number, y: number): { left: string; top: string }`

- [ ] **Step 1: Criar `web/public/totem/cenario.svg`**

Placeholder de 1080×1920: fundo escuro, um chão sugerido e uma faixa de topo. Existe para conferir que a cena transparente compõe com o que está atrás.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b2440"/>
      <stop offset="60%" stop-color="#0e1424"/>
      <stop offset="100%" stop-color="#090b12"/>
    </linearGradient>
    <linearGradient id="mesa" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3a2a1c"/>
      <stop offset="100%" stop-color="#1a120c"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#ceu)"/>
  <circle cx="540" cy="620" r="420" fill="#2a3a6b" opacity="0.25"/>
  <rect y="1360" width="1080" height="560" fill="url(#mesa)"/>
  <rect y="1360" width="1080" height="6" fill="#5a4530" opacity="0.7"/>
  <rect x="60" y="70" width="960" height="120" rx="24" fill="#000000" opacity="0.35"/>
  <text x="540" y="148" text-anchor="middle" fill="#5b6b8c" font-family="sans-serif" font-size="52" font-weight="700">FAIXA DE TOPO</text>
  <text x="540" y="1800" text-anchor="middle" fill="#4a3a28" font-family="sans-serif" font-size="40" font-weight="700">ARTE PLACEHOLDER 1080x1920</text>
</svg>
```

- [ ] **Step 2: Escrever o teste que falha**

Create `web/lib/totem/arte.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ARTE, posicaoNoPalco } from "./arte";

describe("posicaoNoPalco", () => {
  it("converte percentual em left e top", () => {
    expect(posicaoNoPalco(50, 25)).toEqual({ left: "50%", top: "25%" });
  });

  it("prende valores acima de 100", () => {
    expect(posicaoNoPalco(140, 300)).toEqual({ left: "100%", top: "100%" });
  });

  it("prende valores negativos em zero", () => {
    expect(posicaoNoPalco(-20, -1)).toEqual({ left: "0%", top: "0%" });
  });

  it("trata numero invalido como zero", () => {
    expect(posicaoNoPalco(Number.NaN, 10)).toEqual({ left: "0%", top: "10%" });
  });
});

describe("ARTE", () => {
  it("mantem todas as coordenadas dentro do palco", () => {
    for (const eixo of [ARTE.nivel, ARTE.tempo]) {
      expect(eixo.x).toBeGreaterThanOrEqual(0);
      expect(eixo.x).toBeLessThanOrEqual(100);
      expect(eixo.y).toBeGreaterThanOrEqual(0);
      expect(eixo.y).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
npx vitest run lib/totem/arte.test.ts
```
Expected: FAIL — `Cannot find module './arte'`.

- [ ] **Step 4: Implementar `web/lib/totem/arte.ts`**

```ts
/**
 * Onde cada peca do HUD cai sobre a arte. Tudo em percentual do palco de
 * 1080x1920, e nao em pixel: a arte pode ser reexportada em outra densidade sem
 * invalidar este arquivo.
 *
 * Trocada a arte, abra /totem?calibrar, arraste cada peca e cole aqui o que a
 * tela imprimir.
 */
export type Arte = {
  imagem: string;
  /** Barra de enchimento: centro e largura, ambos em percentual do palco. */
  nivel: { x: number; y: number; largura: number };
  /** Cronometro: centro e altura da fonte em percentual do palco. */
  tempo: { x: number; y: number; tamanho: number };
};

export const ARTE: Arte = {
  imagem: "/totem/cenario.svg",
  nivel: { x: 50, y: 88, largura: 60 },
  tempo: { x: 50, y: 8, tamanho: 5 },
};

function limitar(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.min(Math.max(valor, 0), 100);
}

/** Percentual do palco vira `left`/`top` prontos para o style inline. */
export function posicaoNoPalco(
  x: number,
  y: number,
): { left: string; top: string } {
  return { left: `${limitar(x)}%`, top: `${limitar(y)}%` };
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npx vitest run lib/totem/arte.test.ts
```
Expected: PASS, 5 testes.

- [ ] **Step 6: Colocar a arte no palco**

Replace `web/app/totem/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ARTE } from "@/lib/totem/arte";
import { PALCO_A, PALCO_L, usePalco } from "@/lib/totem/palco";

export default function Totem() {
  const escala = usePalco();
  const [semArte, setSemArte] = useState(false);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-1/2 origin-center overflow-hidden bg-[#09090b]"
        style={{
          width: PALCO_L,
          height: PALCO_A,
          transform: `translate(-50%, -50%) scale(${escala})`,
        }}
      >
        {!semArte && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ARTE.imagem}
            alt=""
            width={PALCO_L}
            height={PALCO_A}
            className="absolute inset-0 h-full w-full select-none"
            onError={() => setSemArte(true)}
          />
        )}
      </div>
    </main>
  );
}
```

`<img>` cru, e não `next/image`: a arte tem tamanho fixo conhecido, ocupa o palco inteiro e não se beneficia de `srcset`. O comentário de eslint evita que a regra `no-img-element` quebre o lint.

- [ ] **Step 7: Verificar, typecheck e commit**

```bash
npm run dev    # confira http://localhost:3000/totem
npm run typecheck
npm test
cd ..
git add web/public/totem web/lib/totem web/app/totem
git commit -m "feat(totem): arte de fundo e coordenadas do HUD"
```

---

### Task 3: Cena 3D transparente em retrato

Entrega: as garrafas e as gotas aparecem sobre a arte, sem chão opaco e sem fog, no enquadramento vertical.

**Files:**
- Modify: `web/components/PourScene.tsx`
- Create: `web/app/totem/CenaTotem.tsx`
- Modify: `web/app/totem/page.tsx`

**Interfaces:**
- Consumes: `ARTE` (Task 2).
- Produces:
  - `Cena` exportada de `@/components/PourScene`, com prop `ambiente?: "estudio" | "aberto"` (padrão `"estudio"`)
  - `<CenaTotem tilt={number} running={boolean} round={number} onProgress={(acertos, perdidas) => void} />`

- [ ] **Step 1: Parametrizar o cenário em `web/components/PourScene.tsx`**

Troque o tipo `Props` e a assinatura de `Cena`:

```tsx
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
};

export function Cena({
  tilt,
  running,
  round,
  onProgress,
  ambiente = "estudio",
}: Props) {
```

- [ ] **Step 2: Tornar o fog e o chão condicionais**

Troque a linha do `<fog>`:

```tsx
      {/* Dissolve a borda distante do chao no fundo da pagina, senao o piso
          termina numa linha reta que denuncia o plano. No totem a arte e o
          fundo, e a neblina a taparia. */}
      {ambiente === "estudio" && (
        <fog attach="fog" args={["#09090b", 11, 26]} />
      )}
```

E troque o material do chão, no fim do componente:

```tsx
      {/* Chao ao nivel da base da jarra. Bem maior que o enquadramento para
          que as bordas fiquem fora de vista e nao parecam uma laje solta. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        {ambiente === "estudio" ? (
          <meshStandardMaterial color="#131319" roughness={1} />
        ) : (
          // Só a sombra sobrevive: e ela que ancora as garrafas no cenario.
          <shadowMaterial opacity={0.35} />
        )}
      </mesh>
```

`PourScene` continua exatamente como está — sem `ambiente`, o padrão `"estudio"` reproduz o comportamento de hoje.

- [ ] **Step 3: Verificar que `/` não mudou**

```bash
npm run dev
```
Abra `http://localhost:3000/`, conecte no simulador, segure espaço e derrame. Esperado: idêntico ao que era — chão escuro, neblina ao fundo, gotas caindo.

- [ ] **Step 4: Criar `web/app/totem/CenaTotem.tsx`**

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { Cena } from "@/components/PourScene";

type Props = {
  tilt: number;
  running: boolean;
  round: number;
  onProgress: (acertos: number, perdidas: number) => void;
};

/**
 * Enquadramento retrato.
 *
 * A area jogavel vai de x = ±2.6 e de y = 0 a y ≈ 6. Num palco 9:16 com fov
 * vertical de 42°, a largura visivel e cerca de 0.43 × distancia, entao cobrir
 * 5.2 unidades exige a camera a uns 13.5 de distancia.
 */
export function CenaTotem(props: Props) {
  return (
    <Canvas
      className="absolute inset-0"
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true }}
      camera={{ position: [0, 3.2, 13.5], fov: 42 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 3.0, 0);
        // Sem isto o canvas pinta o proprio fundo e a arte some.
        gl.setClearAlpha(0);
      }}
    >
      <Cena {...props} ambiente="aberto" />
    </Canvas>
  );
}
```

- [ ] **Step 5: Montar a cena sobre a arte**

Em `web/app/totem/page.tsx`, adicione o import:

```tsx
import { CenaTotem } from "./CenaTotem";
```

E, logo depois do `<img>`, dentro do palco:

```tsx
        <CenaTotem
          tilt={0}
          running={false}
          round={0}
          onProgress={() => {}}
        />
```

As props ficam fixas nesta task; a Task 4 as liga ao jogo.

- [ ] **Step 6: Verificar o enquadramento**

```bash
npm run dev
```
Abra `http://localhost:3000/totem`. Esperado: a garrafa de cima e a jarra aparecem **sobre a arte**, com a mesa do placeholder visível atrás, e a sombra das garrafas caindo no chão invisível.

Se a cena estiver cortada ou pequena demais, ajuste `position` e `fov` em `CenaTotem.tsx` — os valores são ponto de partida calculado, não medida final. Anote os valores finais.

- [ ] **Step 7: Typecheck, testes e commit**

```bash
npm run typecheck
npm test
cd ..
git add web/components/PourScene.tsx web/app/totem
git commit -m "feat(totem): cena transparente em enquadramento retrato"
```

---

### Task 4: Jogo ligado, HUD e reinício automático

Entrega: com o simulador, derramar enche a jarra, o cronômetro corre, a tela de vitória aparece e a partida se reinicia sozinha 8 s depois.

**Files:**
- Create: `web/app/totem/Hud.tsx`
- Modify: `web/app/totem/page.tsx`

**Interfaces:**
- Consumes: `ARTE`, `posicaoNoPalco` (Task 2); `CenaTotem` (Task 3); `nivelDeEnchimento`, `formatarTempo` de `@/lib/game/pour`; `MockSpinSource`, `BleSpinSource`, `INITIAL_STATE`, tipos de `@/lib/spin-source/*`.
- Produces: `<Hud nivel={number} tempo={number} venceu={boolean} />`

- [ ] **Step 1: Criar `web/app/totem/Hud.tsx`**

```tsx
"use client";

import { formatarTempo } from "@/lib/game/pour";
import { ARTE, posicaoNoPalco } from "@/lib/totem/arte";
import { PALCO_A } from "@/lib/totem/palco";

type Props = {
  /** 0 a 1. */
  nivel: number;
  /** Segundos. */
  tempo: number;
  venceu: boolean;
};

export function Hud({ nivel, tempo, venceu }: Props) {
  return (
    <>
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 font-mono font-black tabular-nums text-white"
        style={{
          ...posicaoNoPalco(ARTE.tempo.x, ARTE.tempo.y),
          fontSize: `${(ARTE.tempo.tamanho / 100) * PALCO_A}px`,
          textShadow: "0 0 40px rgba(0,0,0,0.8)",
        }}
      >
        {formatarTempo(tempo)}
      </div>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          ...posicaoNoPalco(ARTE.nivel.x, ARTE.nivel.y),
          width: `${ARTE.nivel.largura}%`,
        }}
      >
        <div className="mb-3 flex items-baseline justify-between text-3xl font-bold text-white/80">
          <span>JARRA</span>
          <span className="tabular-nums">{Math.round(nivel * 100)}%</span>
        </div>
        <div className="h-10 overflow-hidden rounded-full bg-black/50 ring-4 ring-white/20">
          <div
            className="h-full rounded-full bg-amber-400 transition-[width] duration-100"
            style={{ width: `${nivel * 100}%` }}
          />
        </div>
      </div>

      {venceu && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center">
          <p className="text-8xl font-black text-amber-300">JARRA CHEIA!</p>
          <p className="mt-8 font-mono text-9xl font-black tabular-nums text-white">
            {formatarTempo(tempo)}
          </p>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Ligar o jogo em `web/app/totem/page.tsx`**

Replace o arquivo inteiro:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CenaTotem } from "./CenaTotem";
import { Hud } from "./Hud";
import { nivelDeEnchimento } from "@/lib/game/pour";
import { ARTE } from "@/lib/totem/arte";
import { PALCO_A, PALCO_L, usePalco } from "@/lib/totem/palco";
import { MockSpinSource } from "@/lib/spin-source/mock";
import {
  INITIAL_STATE,
  type SpinSource,
  type SpinState,
} from "@/lib/spin-source/types";

type Fase = "pronto" | "jogando" | "venceu";

/** Quanto a tela de vitoria fica no ar antes de a proxima partida comecar. */
const TEMPO_DE_VITORIA = 8000;

export default function Totem() {
  const escala = usePalco();
  const [semArte, setSemArte] = useState(false);

  const [source, setSource] = useState<SpinSource | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<SpinState>(INITIAL_STATE);

  const [fase, setFase] = useState<Fase>("pronto");
  const [acertos, setAcertos] = useState(0);
  const [tempo, setTempo] = useState(0);
  const [round, setRound] = useState(0);
  const inicio = useRef(0);
  const faseRef = useRef<Fase>("pronto");

  useEffect(() => {
    if (!source) return;
    const unsubState = source.subscribe(setState);
    const unsubConn = source.subscribeConnection((isConnected) => {
      setConnected(isConnected);
      if (!isConnected) setState(INITIAL_STATE);
    });
    return () => {
      unsubState();
      unsubConn();
    };
  }, [source]);

  useEffect(() => {
    if (fase !== "jogando") return;
    const id = setInterval(
      () => setTempo((performance.now() - inicio.current) / 1000),
      50,
    );
    return () => clearInterval(id);
  }, [fase]);

  const reiniciar = useCallback(() => {
    faseRef.current = "pronto";
    setRound((r) => r + 1);
    setAcertos(0);
    setTempo(0);
    setFase("pronto");
  }, []);

  // Num totem publico ninguem aperta "recomecar": a fila anda sozinha.
  useEffect(() => {
    if (fase !== "venceu") return;
    const id = setTimeout(reiniciar, TEMPO_DE_VITORIA);
    return () => clearTimeout(id);
  }, [fase, reiniciar]);

  // As viradas de fase sao reacao ao que a cena reporta, nao sincronizacao de
  // estado. O ref espelha a fase para este callback nao precisar ser recriado.
  const onProgress = useCallback((a: number, p: number) => {
    setAcertos(a);

    if (faseRef.current === "pronto" && a + p > 0) {
      // A partida comeca na primeira gota, nao num botao: o cronometro mede so
      // tempo de jogo.
      faseRef.current = "jogando";
      inicio.current = performance.now();
      setFase("jogando");
    } else if (faseRef.current === "jogando" && nivelDeEnchimento(a) >= 1) {
      faseRef.current = "venceu";
      setFase("venceu");
    }
  }, []);

  // Provisorio: some na Task 5, quando o painel de operador entra.
  const usarSimulador = useCallback(async () => {
    const mock = new MockSpinSource();
    await mock.connect();
    setSource(mock);
  }, []);

  const mock = source instanceof MockSpinSource ? source : null;

  useEffect(() => {
    if (!mock) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      mock.setPouring(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      mock.setPouring(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [mock]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-1/2 origin-center overflow-hidden bg-[#09090b]"
        style={{
          width: PALCO_L,
          height: PALCO_A,
          transform: `translate(-50%, -50%) scale(${escala})`,
        }}
      >
        {!semArte && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ARTE.imagem}
            alt=""
            width={PALCO_L}
            height={PALCO_A}
            className="absolute inset-0 h-full w-full select-none"
            onError={() => setSemArte(true)}
          />
        )}

        <CenaTotem
          tilt={state.tilt}
          running={connected && fase !== "venceu"}
          round={round}
          onProgress={onProgress}
        />

        <Hud
          nivel={nivelDeEnchimento(acertos)}
          tempo={tempo}
          venceu={fase === "venceu"}
        />

        {!connected && (
          <button
            type="button"
            onClick={usarSimulador}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-2xl bg-white/10 px-10 py-6 text-3xl font-bold text-white"
          >
            Usar simulador
          </button>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Jogar uma partida inteira**

```bash
npm run dev
```
Em `http://localhost:3000/totem`: clique em **Usar simulador**, segure **espaço**. Confira, na ordem:

1. as gotas caem e a barra JARRA sobe;
2. o cronômetro começa a correr na primeira gota, não antes;
3. ao chegar em 100%, a tela de vitória cobre o palco com o tempo final;
4. cerca de 8 s depois a tela some sozinha, a barra volta a 0% e o cronômetro zera;
5. derramar de novo começa uma partida nova.

- [ ] **Step 4: Typecheck, testes e commit**

```bash
npm run typecheck
npm test
cd ..
git add web/app/totem
git commit -m "feat(totem): jogo ligado, HUD e reinicio automatico"
```

---

### Task 5: Painel de operador

Entrega: a tela abre com os botões de conexão; conectada, fica só o jogo; um toque no canto superior direito reabre o painel.

**Files:**
- Create: `web/lib/totem/ambiente.ts`
- Create: `web/app/totem/Operador.tsx`
- Modify: `web/app/totem/page.tsx`

**Interfaces:**
- Consumes: `BleSpinSource`, `ConnectionCancelled` de `@/lib/spin-source/ble`; `MockSpinSource`; `bluetoothAvailability` de `@/lib/spin-source/availability`.
- Produces:
  - `useContextoSeguro(): boolean | null` (`null` até a tela montar no navegador)
  - `<Operador ... />` — ver props no Step 2.

- [ ] **Step 1: Criar `web/lib/totem/ambiente.ts`**

`isBluetoothAvailable()` só testa se `navigator.bluetooth` existe — e ele existe
mesmo quando a página está aberta pelo IP da rede. Nesse caso o aviso de
"navegador sem Web Bluetooth" não aparece, e `requestDevice()` estoura com um
erro cru do browser que não diz o que fazer. Este hook cobre o buraco sem tocar
em `lib/spin-source/`.

```ts
"use client";

import { useEffect, useState } from "react";

/**
 * `null` ate a tela montar: o servidor nao tem `window`, e responder no render
 * faria o HTML do servidor divergir do cliente.
 */
export function useContextoSeguro(): boolean | null {
  const [seguro, setSeguro] = useState<boolean | null>(null);
  useEffect(() => setSeguro(window.isSecureContext), []);
  return seguro;
}
```

- [ ] **Step 2: Criar `web/app/totem/Operador.tsx`**

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { bluetoothAvailability } from "@/lib/spin-source/availability";
import { MockSpinSource } from "@/lib/spin-source/mock";
import type { SpinSource } from "@/lib/spin-source/types";
import { useContextoSeguro } from "@/lib/totem/ambiente";

type Props = {
  aberto: boolean;
  source: SpinSource | null;
  connected: boolean;
  connecting: boolean;
  erro: string | null;
  aoConectar: () => void;
  aoSimular: () => void;
  aoDesconectar: () => void;
  aoZerar: () => void;
  aoFechar: () => void;
};

export function Operador({
  aberto,
  source,
  connected,
  connecting,
  erro,
  aoConectar,
  aoSimular,
  aoDesconectar,
  aoZerar,
  aoFechar,
}: Props) {
  const bluetoothReady = useSyncExternalStore(
    bluetoothAvailability.subscribe,
    bluetoothAvailability.getSnapshot,
    bluetoothAvailability.getServerSnapshot,
  );
  const seguro = useContextoSeguro();

  if (!aberto) return null;

  const mock = source instanceof MockSpinSource ? source : null;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8 bg-black/85 p-16 text-white"
      onClick={connected ? aoFechar : undefined}
    >
      <div
        className="flex w-full flex-col items-stretch gap-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-4xl font-bold tracking-widest">
          {connected
            ? source?.kind === "mock"
              ? "SIMULADOR"
              : "GARRAFA ONLINE"
            : "DESCONECTADO"}
        </p>

        {erro && (
          <p className="rounded-2xl border-4 border-red-500 bg-red-950 p-6 text-center text-3xl text-red-200">
            {erro}
          </p>
        )}

        {!connected ? (
          <>
            <button
              type="button"
              onClick={aoConectar}
              disabled={connecting}
              className="rounded-3xl bg-emerald-500 px-12 py-10 text-5xl font-black text-black disabled:opacity-50"
            >
              {connecting ? "Conectando…" : "Conectar garrafa"}
            </button>
            <button
              type="button"
              onClick={aoSimular}
              disabled={connecting}
              className="rounded-3xl border-4 border-white/30 px-12 py-10 text-5xl font-bold disabled:opacity-50"
            >
              Usar simulador
            </button>
            {seguro === false ? (
              <p className="rounded-2xl border-4 border-amber-500 bg-amber-950 p-6 text-center text-3xl text-amber-100">
                Esta página está aberta pelo IP da rede. O navegador só libera
                Bluetooth em http://localhost:3000 — abra por ali, ou jogue no
                simulador.
              </p>
            ) : (
              !bluetoothReady && (
                <p className="rounded-2xl border-4 border-amber-500 bg-amber-950 p-6 text-center text-3xl text-amber-100">
                  Este navegador não tem Web Bluetooth. Use Chrome ou Edge, ou
                  jogue no simulador.
                </p>
              )
            )}
          </>
        ) : (
          <>
            {mock && (
              <button
                type="button"
                onPointerDown={() => mock.setPouring(true)}
                onPointerUp={() => mock.setPouring(false)}
                onPointerLeave={() => mock.setPouring(false)}
                className="select-none rounded-3xl bg-amber-500 px-12 py-10 text-5xl font-black text-black"
              >
                Segure para derramar
              </button>
            )}

            {source?.kind === "ble" && (
              <button
                type="button"
                onClick={aoZerar}
                className="rounded-3xl border-4 border-white/30 px-12 py-8 text-4xl font-bold"
              >
                Marcar posição atual como 0°
              </button>
            )}

            <button
              type="button"
              onClick={aoDesconectar}
              className="rounded-3xl border-4 border-white/30 px-12 py-8 text-4xl font-bold"
            >
              Desconectar
            </button>

            <p className="text-center text-2xl text-white/40">
              Toque fora para voltar ao jogo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

O "marcar 0°" só aparece no BLE porque a inclinação do mock não tem pose de referência para zerar.

- [ ] **Step 3: Trocar o botão provisório pelo painel**

Em `web/app/totem/page.tsx`, adicione os imports:

```tsx
import { Operador } from "./Operador";
import { BleSpinSource, ConnectionCancelled } from "@/lib/spin-source/ble";
```

Adicione o estado, junto dos outros `useState`:

```tsx
  const [connecting, setConnecting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [painelAberto, setPainelAberto] = useState(true);
```

Troque `usarSimulador` por este bloco de conexão:

```tsx
  const iniciar = useCallback(async (nova: SpinSource) => {
    setErro(null);
    setConnecting(true);
    try {
      await nova.connect();
      setSource(nova);
    } catch (e) {
      // Fechar o seletor de dispositivos e uma decisao, nao um problema.
      if (e instanceof ConnectionCancelled) return;
      setErro(e instanceof Error ? e.message : "Falha ao conectar.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const desconectar = useCallback(async () => {
    await source?.disconnect();
    setSource(null);
    setConnected(false);
    setState(INITIAL_STATE);
  }, [source]);
```

No efeito da fonte, faça a queda de conexão reabrir o painel — é lá que o aviso cabe, e não sobre o jogo:

```tsx
    const unsubConn = source.subscribeConnection((isConnected) => {
      setConnected(isConnected);
      if (!isConnected) {
        setState(INITIAL_STATE);
        setErro("A garrafa desconectou.");
        setPainelAberto(true);
      }
    });
```

Feche o painel quando a conexão subir:

```tsx
  useEffect(() => {
    if (connected) setPainelAberto(false);
  }, [connected]);
```

Remova o `<button>` provisório e ponha, no lugar:

```tsx
        <button
          type="button"
          aria-label="Abrir painel do operador"
          onClick={() => setPainelAberto(true)}
          className="absolute right-0 top-0 z-10 h-40 w-40 cursor-default opacity-0"
        />

        <Operador
          aberto={painelAberto}
          source={source}
          connected={connected}
          connecting={connecting}
          erro={erro}
          aoConectar={() => iniciar(new BleSpinSource())}
          aoSimular={() => iniciar(new MockSpinSource())}
          aoDesconectar={desconectar}
          aoZerar={() => source?.send("level")}
          aoFechar={() => setPainelAberto(false)}
        />
```

- [ ] **Step 4: Verificar o fluxo do operador**

```bash
npm run dev
```
Em `http://localhost:3000/totem`, confira na ordem:

1. abre com o painel e dois botões grandes;
2. **Usar simulador** → painel some, sobra o jogo sobre a arte;
3. toque no canto superior direito → painel volta com **Segure para derramar** e **Desconectar**;
4. segure o botão de derramar → as gotas saem com o painel aberto;
5. toque fora do bloco → painel some;
6. **Desconectar** → volta ao estado inicial, sem faixa vermelha.

- [ ] **Step 5: Typecheck, testes e commit**

```bash
npm run typecheck
npm test
cd ..
git add web/app/totem web/lib/totem
git commit -m "feat(totem): painel de operador escondido atras do canto secreto"
```

---

### Task 6: Modo calibração e documentação

Entrega: `/totem?calibrar` permite arrastar cada peça do HUD e produz o objeto `ARTE` pronto para colar; o README explica a troca de arte.

**Files:**
- Create: `web/app/totem/Calibrador.tsx`
- Modify: `web/app/totem/page.tsx`
- Modify: `web/README.md`

**Interfaces:**
- Consumes: `ARTE` (Task 2).
- Produces: `<Calibrador />` — autocontido, sem props.

- [ ] **Step 1: Criar `web/app/totem/Calibrador.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { ARTE, type Arte } from "@/lib/totem/arte";

const LINHAS = Array.from({ length: 19 }, (_, i) => (i + 1) * 100);

type Peca = "nivel" | "tempo";

export function Calibrador() {
  const [arte, setArte] = useState<Arte>(ARTE);
  const [peca, setPeca] = useState<Peca>("nivel");
  const palco = useRef<HTMLDivElement>(null);
  const arrastando = useRef(false);

  function mover(e: React.PointerEvent) {
    if (!arrastando.current || !palco.current) return;
    const caixa = palco.current.getBoundingClientRect();
    // A caixa ja vem escalada, entao a divisao devolve percentual correto sem
    // que este componente saiba nada sobre a escala do palco.
    const x = Number((((e.clientX - caixa.left) / caixa.width) * 100).toFixed(2));
    const y = Number((((e.clientY - caixa.top) / caixa.height) * 100).toFixed(2));

    // Ramo explicito em vez de chave computada: `{ ...a, [peca]: ... }` perde o
    // tipo de `Arte` e o `npm run typecheck` reclama.
    setArte((a) =>
      peca === "nivel"
        ? { ...a, nivel: { ...a.nivel, x, y } }
        : { ...a, tempo: { ...a.tempo, x, y } },
    );
  }

  const saida = JSON.stringify(arte, null, 2).replace(/"([^"]+)":/g, "$1:");

  return (
    <div
      ref={palco}
      className="absolute inset-0 z-20"
      onPointerMove={mover}
      onPointerUp={() => (arrastando.current = false)}
      onPointerLeave={() => (arrastando.current = false)}
    >
      <div className="pointer-events-none absolute inset-0">
        {LINHAS.map((px) => (
          <div
            key={px}
            className="absolute left-0 w-full border-t border-cyan-400/30"
            style={{ top: px }}
          >
            <span className="ml-2 text-xl text-cyan-300/60">{px}</span>
          </div>
        ))}
        <div className="absolute left-1/2 top-0 h-full border-l border-cyan-400/30" />
      </div>

      {(["nivel", "tempo"] as const).map((nome) => (
        <div
          key={nome}
          onPointerDown={() => {
            setPeca(nome);
            arrastando.current = true;
          }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-xl border-4 px-6 py-3 text-2xl font-bold ${
            peca === nome
              ? "border-cyan-300 bg-cyan-400/40 text-white"
              : "border-white/30 bg-black/40 text-white/60"
          }`}
          style={{ left: `${arte[nome].x}%`, top: `${arte[nome].y}%` }}
        >
          {nome}
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-8 text-white">
        <p className="mb-4 text-3xl">
          Arraste cada peça para o lugar dela na arte. Editando:{" "}
          <b className="text-cyan-300">{peca}</b>
        </p>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(`export const ARTE = ${saida};`)
          }
          className="mb-6 rounded-2xl bg-cyan-500 px-8 py-5 text-3xl font-bold text-black"
        >
          copiar
        </button>
        <pre className="max-h-72 overflow-auto rounded-2xl bg-[#09090b] p-6 text-2xl text-cyan-200">
          {`export const ARTE = ${saida};`}
        </pre>
        <p className="mt-4 text-2xl text-white/50">
          Cole em lib/totem/arte.ts e recarregue.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Ligar o modo em `web/app/totem/page.tsx`**

Import:

```tsx
import { Calibrador } from "./Calibrador";
```

Estado e efeito:

```tsx
  const [calibrando, setCalibrando] = useState(false);

  // Ler a query direto do `window` evita embrulhar a pagina num <Suspense> so
  // por causa de um modo de manutencao — e `searchParams` virou assincrono no
  // Next 16.
  useEffect(() => {
    setCalibrando(new URLSearchParams(window.location.search).has("calibrar"));
  }, []);
```

Troque a prop `aberto` do `<Operador>` para o painel não cobrir a calibração:

```tsx
          aberto={painelAberto && !calibrando}
```

E, por último dentro do palco:

```tsx
        {calibrando && <Calibrador />}
```

- [ ] **Step 3: Calibrar contra o placeholder**

```bash
npm run dev
```
Abra `http://localhost:3000/totem?calibrar`. Arraste as caixas `nivel` e `tempo` para onde elas devem ficar sobre a arte, clique **copiar** e cole o bloco em `web/lib/totem/arte.ts`. Recarregue `/totem` sem a query e confira que o HUD está no lugar novo.

Os testes de `arte.test.ts` leem `ARTE`, então continuam passando com os valores novos — desde que as coordenadas fiquem entre 0 e 100.

- [ ] **Step 4: Documentar no README**

Modify `web/README.md` — acrescente ao fim:

```markdown
## Totem 1080×1920

`http://localhost:3000/totem` — a tela de painel vertical, para TV ou totem em pé.
O jogo é o mesmo de `/`, mas a cena roda sobre uma arte de fundo e o HUD fica
reduzido a tempo e nível da jarra.

**Trocar a arte:**

1. Exporte a arte em **1080×1920 exatos** e salve em `public/totem/`.
2. Aponte `imagem` em `lib/totem/arte.ts` para o arquivo novo.
3. Abra `http://localhost:3000/totem?calibrar`, arraste as peças do HUD para o
   lugar e clique **copiar**.
4. Cole o bloco em `lib/totem/arte.ts`.

**Operação no evento:** com a garrafa conectada a tela mostra só o jogo. Um toque
no **canto superior direito** reabre o painel do operador, onde ficam o
**Marcar posição atual como 0°** e o **Desconectar**. A partida reinicia sozinha
8 s depois de a jarra encher.

A tela `/` continua funcionando e é a reserva do evento.
```

- [ ] **Step 5: Verificação final e commit**

```bash
npm run typecheck
npm test
npm run build
cd ..
git add web/app/totem web/README.md web/lib/totem
git commit -m "feat(totem): modo calibracao e documentacao da troca de arte"
```

---

## Verificação final

- [ ] `npm test` verde, com os 9 testes novos de `lib/totem/` somados aos que já existiam.
- [ ] `npm run typecheck` sem erro.
- [ ] `npm run build` sem erro.
- [ ] `/` visualmente idêntica ao que era: chão opaco, neblina, barra lateral.
- [ ] `/totem` em janela 1080×1920 desenha pixel a pixel; em janela pequena encolhe inteira sem desalinhar.
- [ ] Partida completa no simulador: enche, anuncia, reinicia sozinha.
- [ ] `git log --oneline` mostra um commit por task.
