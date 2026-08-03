# Temas de marca: Red Bull e óleo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O jogo de derramar passa a trocar de marca por configuração: `redbull` (lata fotográfica, fundo azul, líquido âmbar) e `oleo` (galão modelado, líquido escuro).

**Architecture:** Um módulo `lib/temas/` guarda um objeto `Tema` por marca — recipiente, fundo, cor do líquido e coordenadas do HUD. `PourScene` deixa de saber qual é o recipiente e recebe isso por prop, com o tema padrão como valor default. A lata entra como plano texturizado girando em Z, o que é indistinguível de uma lata inclinando porque a câmera é frontal.

**Tech Stack:** three.js, @react-three/fiber, Next.js 16, TypeScript, Tailwind v4, vitest.

## Global Constraints

- **Assets copiados, nunca referenciados de fora.** Um caminho para `brand-ninja2` quebra no primeiro deploy.
- **Nomes de arquivo sem espaço e sem acento.** Espaço em URL exige escape e transforma erro de digitação em 404 silencioso.
- **Não copiar** `bomba.png`, `bomba a.png`, `explosao a.png`, `coracao.png`, `inicio.png` — são do jogo de cortar.
- **A boca do recipiente fica na origem do grupo.** É de lá que as gotas nascem e em torno dela que a peça gira.
- **Não modificar:** `web/lib/game/pour.ts`, `web/lib/spin-source/**`, `web/app/page.tsx`, `web/components/StatusBar.tsx`, o firmware ou o contrato BLE.
- **Tema desconhecido cai no padrão**, nunca quebra: erro de digitação na URL no dia do evento não pode deixar a tela preta.
- **Idioma:** nomes e comentários em português. Comentários só onde explicam *por quê*.
- Todo comando roda em `web/`. O trabalho continua no branch `totem-garrafa`.

## Estrutura

```
web/lib/temas/tipos.ts       tipo Tema e Recipiente
web/lib/temas/redbull.ts     lata, fundo azul, ambar
web/lib/temas/oleo.ts        galao, cenario placeholder, escuro
web/lib/temas/index.ts       registro, resolverTema, sortearLata
web/lib/temas/index.test.ts
web/components/Lata.tsx      plano texturizado com a foto
web/components/PourScene.tsx recipiente e liquido por prop
web/app/totem/page.tsx       resolve o tema pela query
web/app/totem/Hud.tsx        le as coordenadas do tema
web/app/totem/Calibrador.tsx calibra o tema ativo
web/lib/totem/posicao.ts     (renomeado de arte.ts, so posicaoNoPalco)
web/public/temas/redbull/    fundo.png, lata-01..12.png
```

---

### Task 1: Assets e o módulo de temas

Entrega: os PNGs estão no projeto e `resolverTema` / `sortearLata` funcionam, com testes. Nada ainda está ligado — a aplicação segue igual.

**Files:**
- Create: `web/public/temas/redbull/fundo.png` e `lata-01.png` … `lata-12.png` (cópias)
- Create: `web/lib/temas/tipos.ts`
- Create: `web/lib/temas/redbull.ts`
- Create: `web/lib/temas/oleo.ts`
- Create: `web/lib/temas/index.ts`
- Test: `web/lib/temas/index.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Recipiente`, `type PecaHud`, `type Tema` (de `./tipos`)
  - `TEMAS: Record<string, Tema>`, `TEMA_PADRAO: Tema`
  - `resolverTema(nome?: string | null): Tema`
  - `sortearLata(recipiente: Recipiente, sorteio?: () => number): string | null`

- [ ] **Step 1: Copiar e renomear os assets**

```bash
cd "C:/Users/sukat/OneDrive/Desktop/Gabriel Codes/garrafa-main/garrafa-main/web"
mkdir -p public/temas/redbull
ORIG="C:/Users/sukat/OneDrive/Desktop/Gabriel Codes/brand-ninja2/public/logos"
cp "$ORIG/fundo red bull.png" public/temas/redbull/fundo.png
for n in 01 02 03 04 05 06 07 08 09 10 11 12; do
  cp "$ORIG/lata $n.png" "public/temas/redbull/lata-$n.png"
done
ls -1 public/temas/redbull
```
Expected: 13 arquivos — `fundo.png` e `lata-01.png` … `lata-12.png`.

- [ ] **Step 2: Criar `web/lib/temas/tipos.ts`**

```ts
/** Como o recipiente que despeja e desenhado. */
export type Recipiente =
  | {
      tipo: "sprite";
      /** Uma ou mais imagens; sorteia entre elas a cada partida. */
      imagens: string[];
      /** Tamanho do plano em unidades de cena. */
      largura: number;
      altura: number;
    }
  | { tipo: "galao" };

/** Posicao e tamanho de um numero do HUD, em percentual do palco. */
export type PecaHud = { x: number; y: number; tamanho: number };

export type Tema = {
  nome: string;
  recipiente: Recipiente;
  /** Imagem de fundo do palco do totem, proporcao 9:16. */
  fundo: string;
  liquido: { cor: string; emissiva: string };
  hud: {
    /** Ausente quando o fundo do tema nao tem caixa de pontos. */
    pontos?: PecaHud;
    tempo: PecaHud;
    nivel: { x: number; y: number; largura: number };
  };
};
```

A união discriminada existe porque as duas formas são genuinamente diferentes —
uma é foto, a outra é geometria. Um campo opcional em comum esconderia isso e
espalharia `if` pela cena.

- [ ] **Step 3: Criar `web/lib/temas/redbull.ts`**

```ts
import type { Tema } from "./tipos";

const LATAS = Array.from(
  { length: 12 },
  (_, i) => `/temas/redbull/lata-${String(i + 1).padStart(2, "0")}.png`,
);

export const redbull: Tema = {
  nome: "redbull",
  // A PNG tem margem transparente em volta da lata, entao estas medidas sao
  // do plano inteiro e nao do produto. Ajuste visual esperado.
  recipiente: { tipo: "sprite", imagens: LATAS, largura: 1.35, altura: 2.16 },
  fundo: "/temas/redbull/fundo.png",
  liquido: { cor: "#f0b429", emissiva: "#8a5a08" },
  hud: {
    // As caixas PONTOS e TEMPO ja vem desenhadas no fundo; aqui so os valores.
    pontos: { x: 16, y: 13, tamanho: 4 },
    tempo: { x: 84, y: 13, tamanho: 4 },
    nivel: { x: 50, y: 90, largura: 70 },
  },
};
```

- [ ] **Step 4: Criar `web/lib/temas/oleo.ts`**

```ts
import type { Tema } from "./tipos";

export const oleo: Tema = {
  nome: "oleo",
  recipiente: { tipo: "galao" },
  fundo: "/totem/cenario.svg",
  // Oleo de motor usado. A emissiva e baixa de proposito: nao e para clarear a
  // cor, e para a gota nao virar silhueta chapada contra o fundo escuro.
  liquido: { cor: "#3a2410", emissiva: "#140b03" },
  hud: {
    tempo: { x: 50, y: 8, tamanho: 5 },
    nivel: { x: 50, y: 88, largura: 60 },
  },
};
```

- [ ] **Step 5: Escrever o teste que falha**

Create `web/lib/temas/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolverTema, sortearLata, TEMAS, TEMA_PADRAO } from "./index";

describe("resolverTema", () => {
  it("acha o tema pelo nome", () => {
    expect(resolverTema("oleo").nome).toBe("oleo");
    expect(resolverTema("redbull").nome).toBe("redbull");
  });

  it("cai no padrao quando o nome nao existe", () => {
    // Erro de digitacao na URL no dia do evento nao pode deixar a tela preta.
    expect(resolverTema("redbul")).toBe(TEMA_PADRAO);
    expect(resolverTema("")).toBe(TEMA_PADRAO);
  });

  it("cai no padrao sem nome nenhum", () => {
    expect(resolverTema()).toBe(TEMA_PADRAO);
    expect(resolverTema(null)).toBe(TEMA_PADRAO);
  });

  it("usa redbull como padrao", () => {
    expect(TEMA_PADRAO.nome).toBe("redbull");
  });
});

describe("sortearLata", () => {
  const doze = {
    tipo: "sprite" as const,
    imagens: Array.from({ length: 12 }, (_, i) => `lata-${i}.png`),
    largura: 1,
    altura: 2,
  };

  it("devolve uma das imagens listadas", () => {
    expect(sortearLata(doze, () => 0)).toBe("lata-0.png");
    expect(sortearLata(doze, () => 0.5)).toBe("lata-6.png");
  });

  it("nao estoura quando o sorteio devolve 1", () => {
    // Math.random() nunca devolve 1, mas um sorteio injetado pode.
    expect(sortearLata(doze, () => 1)).toBe("lata-11.png");
  });

  it("funciona com uma imagem so", () => {
    const uma = { tipo: "sprite" as const, imagens: ["x.png"], largura: 1, altura: 2 };
    expect(sortearLata(uma, () => 0.99)).toBe("x.png");
  });

  it("devolve null para recipiente que nao e sprite", () => {
    expect(sortearLata({ tipo: "galao" })).toBeNull();
  });
});

describe("coordenadas dos temas", () => {
  it("mantem todo HUD dentro do palco", () => {
    // Coordenada fora de 0-100 poe o numero fora da tela, e isso so apareceria
    // no evento.
    for (const tema of Object.values(TEMAS)) {
      const pecas = [tema.hud.tempo, tema.hud.nivel, tema.hud.pontos].filter(
        (p) => p !== undefined,
      );
      for (const peca of pecas) {
        expect(peca.x).toBeGreaterThanOrEqual(0);
        expect(peca.x).toBeLessThanOrEqual(100);
        expect(peca.y).toBeGreaterThanOrEqual(0);
        expect(peca.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("registra o tema sob a chave igual ao proprio nome", () => {
    for (const [chave, tema] of Object.entries(TEMAS)) {
      expect(tema.nome).toBe(chave);
    }
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

```bash
npx vitest run lib/temas/index.test.ts
```
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 7: Criar `web/lib/temas/index.ts`**

```ts
import { oleo } from "./oleo";
import { redbull } from "./redbull";
import type { Recipiente, Tema } from "./tipos";

export type { PecaHud, Recipiente, Tema } from "./tipos";

export const TEMAS: Record<string, Tema> = { redbull, oleo };

export const TEMA_PADRAO = redbull;

/** Nome desconhecido cai no padrao em vez de quebrar a tela. */
export function resolverTema(nome?: string | null): Tema {
  if (!nome) return TEMA_PADRAO;
  return TEMAS[nome] ?? TEMA_PADRAO;
}

/**
 * Sorteia a imagem da partida. `sorteio` e injetavel para o teste nao depender
 * de Math.random.
 */
export function sortearLata(
  recipiente: Recipiente,
  sorteio: () => number = Math.random,
): string | null {
  if (recipiente.tipo !== "sprite") return null;
  const total = recipiente.imagens.length;
  // Math.random() nunca devolve 1, mas um sorteio injetado pode: sem o clamp o
  // indice sai da lista e a lata some.
  const i = Math.min(Math.floor(sorteio() * total), total - 1);
  return recipiente.imagens[i];
}
```

- [ ] **Step 8: Rodar e confirmar que passa**

```bash
npx vitest run lib/temas/index.test.ts
```
Expected: PASS, 11 testes.

- [ ] **Step 9: Verificar que os assets são servidos**

```bash
npm run dev -- --port 3001
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3001/temas/redbull/fundo.png
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3001/temas/redbull/lata-07.png
```
Expected: `200 image/png` nos dois.

- [ ] **Step 10: Typecheck, lint, suíte e commit**

```bash
npm run typecheck
npx eslint lib/temas
npm test
cd ..
git add web/public/temas web/lib/temas
git commit -m "feat(temas): assets da Red Bull e registro de temas"
```

---

### Task 2: A lata na cena

Entrega: `PourScene` aceita `recipiente` e `liquido` por prop e sabe desenhar a lata. Com o tema padrão sendo `redbull`, a rota `/` já mostra a lata.

**Files:**
- Create: `web/components/Lata.tsx`
- Modify: `web/components/PourScene.tsx`

**Interfaces:**
- Consumes: `Recipiente`, `TEMA_PADRAO`, `sortearLata` (Task 1).
- Produces: `<Lata imagem={string} largura={number} altura={number} />`; `PourScene` e `Cena` ganham as props opcionais `recipiente?: Recipiente` e `liquido?: { cor: string; emissiva: string }`.

- [ ] **Step 1: Criar `web/components/Lata.tsx`**

```tsx
"use client";

import { useLoader } from "@react-three/fiber";
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
  const textura = useLoader(THREE.TextureLoader, imagem);

  // Sem isto a PNG aparece lavada, e o sintoma parece "a arte veio errada" em
  // vez de "faltou uma linha". A atribuicao e idempotente.
  textura.colorSpace = THREE.SRGBColorSpace;

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
```

- [ ] **Step 2: Dar as props novas a `PourScene`**

Em `web/components/PourScene.tsx`, o arquivo já importa
`{ useEffect, useMemo, useRef }` de `"react"`. Acrescente `Suspense` a essa
lista existente — não crie uma segunda linha de import de `react`.

Depois acrescente duas linhas novas junto dos outros imports:

```tsx
import { Lata } from "./Lata";
import { sortearLata, TEMA_PADRAO, type Recipiente } from "@/lib/temas";
```

Troque o tipo `Props`:

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
  /** Sem tema explicito, vale o padrao — e a rota `/` segue o padrao de graca. */
  recipiente?: Recipiente;
  liquido?: { cor: string; emissiva: string };
};
```

E a assinatura de `Cena`:

```tsx
export function Cena({
  tilt,
  running,
  round,
  onProgress,
  ambiente = "estudio",
  recipiente = TEMA_PADRAO.recipiente,
  liquido = TEMA_PADRAO.liquido,
}: Props) {
```

- [ ] **Step 3: Sortear a lata da partida**

Dentro de `Cena`, junto das outras geometrias:

```tsx
  // Uma lata por partida: `round` muda a cada rodada nova, entao o sorteio
  // acompanha sem precisar de estado proprio.
  const lata = useMemo(
    () => sortearLata(recipiente),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipiente, round],
  );
```

- [ ] **Step 4: Trocar o grupo do recipiente**

Substitua o bloco `<group ref={garrafa} …>` inteiro por:

```tsx
      {/* Recipiente de cima: o grupo fica na altura do bico e gira em torno
          dele. Nenhuma peca leva `position` — todas saem posicionadas com a
          boca na origem. */}
      <group ref={garrafa} position={[0, ALTURA_BOCAL, 0]}>
        {recipiente.tipo === "sprite" && lata ? (
          // `useLoader` suspende enquanto a textura carrega; sem o Suspense a
          // cena inteira estoura no primeiro quadro.
          <Suspense fallback={null}>
            <Lata
              imagem={lata}
              largura={recipiente.largura}
              altura={recipiente.altura}
            />
          </Suspense>
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
```

- [ ] **Step 5: Usar a cor do líquido do tema**

Troque o material do líquido acumulado:

```tsx
        <meshStandardMaterial
          color={liquido.cor}
          roughness={0.25}
          emissive={liquido.emissiva}
          emissiveIntensity={0.35}
        />
```

E o das gotas, dentro do `instancedMesh`:

```tsx
        <meshStandardMaterial
          color={liquido.cor}
          roughness={0.2}
          emissive={liquido.emissiva}
          emissiveIntensity={0.3}
        />
```

- [ ] **Step 6: Tirar as cores do óleo de `galao.ts`**

As cores viraram dado de tema. Em `web/components/galao.ts`, apague as
constantes `COR_OLEO` e `COR_OLEO_EMISSIVA` e o comentário de bloco delas.
Em `PourScene.tsx`, tire-as do import de `./galao` — sobram só as quatro
funções `criarCorpo`, `criarAlca`, `criarGargalo`, `criarTampa`.

- [ ] **Step 7: Typecheck, lint e testes**

```bash
cd web
npm run typecheck
npx eslint components lib app
npm test
```
Expected: tudo limpo. `galao.test.ts` continua passando — ele testa geometria,
não cor.

- [ ] **Step 8: Conferir a lata no navegador**

```bash
npm run dev -- --port 3001
```
Abra `http://localhost:3001/`, clique em **Usar simulador** e segure **espaço**.
Confira:

1. a peça de cima é a lata fotográfica, com o rótulo nítido e sem fundo branco;
2. ao inclinar, ela gira em torno do topo;
3. as gotas nascem na boca da lata, não ao lado nem no meio dela;
4. o líquido voltou a ser âmbar;
5. recarregar a página troca a lata por outro sabor.

Se a lata estiver grande ou pequena demais, `largura` e `altura` estão em
`lib/temas/redbull.ts` — dois números.

- [ ] **Step 9: Commit**

```bash
cd ..
git add web/components
git commit -m "feat(temas): lata fotografica como recipiente, liquido por tema"
```

---

### Task 3: O totem resolve o tema

Entrega: `/totem` usa o fundo e o recipiente do tema; `?tema=oleo` volta ao galão.

**Files:**
- Modify: `web/lib/totem/ambiente.ts`
- Modify: `web/app/totem/CenaTotem.tsx`
- Modify: `web/app/totem/page.tsx`

**Interfaces:**
- Consumes: `resolverTema`, `Tema` (Task 1); `Recipiente`, `liquido` em `Cena` (Task 2).
- Produces: `temaDaUrl` — store externa com o nome do tema; `CenaTotem` ganha a prop `tema: Tema`.

- [ ] **Step 1: Ler o tema da URL**

Em `web/lib/totem/ambiente.ts`, acrescente ao fim:

```ts
/**
 * Nome do tema pedido na URL, ou `null`.
 *
 * Store externa pelo mesmo motivo dos vizinhos: ler `window` num efeito e
 * chamar `setState` cai na regra `react-hooks/set-state-in-effect`.
 */
export const temaDaUrl = {
  subscribe(): () => void {
    return () => {};
  },
  getSnapshot(): string | null {
    return new URLSearchParams(window.location.search).get("tema");
  },
  getServerSnapshot(): string | null {
    return null;
  },
};
```

- [ ] **Step 2: Passar o tema para a cena**

Em `web/app/totem/CenaTotem.tsx`, troque o tipo e a chamada:

```tsx
import type { Tema } from "@/lib/temas";

type Props = {
  tilt: number;
  running: boolean;
  round: number;
  onProgress: (acertos: number, perdidas: number) => void;
  tema: Tema;
};
```

E no corpo, troque `<Cena {...props} ambiente="aberto" />` por:

```tsx
      <Cena
        tilt={props.tilt}
        running={props.running}
        round={props.round}
        onProgress={props.onProgress}
        ambiente="aberto"
        recipiente={props.tema.recipiente}
        liquido={props.tema.liquido}
      />
```

- [ ] **Step 3: Resolver o tema na página**

Em `web/app/totem/page.tsx`, acrescente aos imports:

```tsx
import { resolverTema } from "@/lib/temas";
```

E troque o import `modoCalibracao` para trazer também o novo:

```tsx
import { modoCalibracao, temaDaUrl } from "@/lib/totem/ambiente";
```

Junto dos outros `useSyncExternalStore`, acrescente:

```tsx
  const nomeDoTema = useSyncExternalStore(
    temaDaUrl.subscribe,
    temaDaUrl.getSnapshot,
    temaDaUrl.getServerSnapshot,
  );
  const tema = resolverTema(nomeDoTema);
```

- [ ] **Step 4: Usar o fundo do tema**

Troque o `src` da imagem de fundo:

```tsx
          <img
            src={tema.fundo}
            alt=""
            width={PALCO_L}
            height={PALCO_A}
            className="absolute inset-0 h-full w-full select-none"
            onError={() => setSemArte(true)}
          />
```

E passe o tema para a cena:

```tsx
        <CenaTotem
          tilt={state.tilt}
          running={connected && fase !== "venceu"}
          round={round}
          onProgress={onProgress}
          tema={tema}
        />
```

O import de `ARTE` continua nesta task porque o `Hud` ainda depende dele; ele sai
na Task 4.

- [ ] **Step 5: Typecheck, lint e testes**

```bash
cd web
npm run typecheck
npx eslint components lib app
npm test
```

- [ ] **Step 6: Conferir os dois temas**

```bash
npm run dev -- --port 3001
```

- `http://localhost:3001/totem` — fundo azul da Red Bull com as caixas PONTOS e
  TEMPO, e a lata despejando âmbar.
- `http://localhost:3001/totem?tema=oleo` — cenário placeholder, galão e óleo
  escuro.
- `http://localhost:3001/totem?tema=xpto` — cai no fundo da Red Bull, sem tela
  preta e sem erro no console.

- [ ] **Step 7: Commit**

```bash
cd ..
git add web/lib/totem/ambiente.ts web/app/totem
git commit -m "feat(temas): totem resolve o tema pela query"
```

---

### Task 4: HUD e calibração por tema

Entrega: os números do HUD caem nas caixas do fundo de cada tema, e `?calibrar` calibra o tema ativo.

**Files:**
- Create: `web/lib/totem/posicao.ts` (renomeado de `arte.ts`)
- Create: `web/lib/totem/posicao.test.ts` (renomeado de `arte.test.ts`)
- Delete: `web/lib/totem/arte.ts`, `web/lib/totem/arte.test.ts`
- Modify: `web/app/totem/Hud.tsx`
- Modify: `web/app/totem/Calibrador.tsx`
- Modify: `web/app/totem/page.tsx`

**Interfaces:**
- Consumes: `Tema`, `PecaHud` (Task 1); `tema` resolvido na página (Task 3).
- Produces: `posicaoNoPalco(x, y)` em `@/lib/totem/posicao`; `<Hud tema={Tema} acertos={number} nivel={number} tempo={number} venceu={boolean} />`; `<Calibrador tema={Tema} />`.

- [ ] **Step 1: Renomear o utilitário e soltar o `ARTE`**

Create `web/lib/totem/posicao.ts`:

```ts
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

Create `web/lib/totem/posicao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { posicaoNoPalco } from "./posicao";

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
```

Apague `web/lib/totem/arte.ts` e `web/lib/totem/arte.test.ts`. O teste do `ARTE`
não é migrado: a checagem de coordenadas dentro do palco passou para
`lib/temas/index.test.ts`, agora cobrindo todos os temas.

```bash
cd web
rm lib/totem/arte.ts lib/totem/arte.test.ts
```

- [ ] **Step 2: Reescrever `web/app/totem/Hud.tsx`**

```tsx
"use client";

import { formatarTempo } from "@/lib/game/pour";
import type { Tema } from "@/lib/temas";
import { posicaoNoPalco } from "@/lib/totem/posicao";
import { PALCO_A } from "@/lib/totem/palco";

type Props = {
  tema: Tema;
  /** Gotas que entraram na jarra. */
  acertos: number;
  /** 0 a 1. */
  nivel: number;
  /** Segundos. */
  tempo: number;
  venceu: boolean;
};

/** Percentual de altura do palco vira tamanho de fonte em pixel. */
function fonte(tamanho: number): string {
  return `${(tamanho / 100) * PALCO_A}px`;
}

export function Hud({ tema, acertos, nivel, tempo, venceu }: Props) {
  const { pontos, tempo: caixaTempo, nivel: barra } = tema.hud;

  return (
    <>
      {/* Os rotulos PONTOS e TEMPO ja vem desenhados no fundo do tema: aqui so
          o valor, senao o texto aparece duas vezes. */}
      {pontos && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 font-black tabular-nums text-[#c8102e]"
          style={{
            ...posicaoNoPalco(pontos.x, pontos.y),
            fontSize: fonte(pontos.tamanho),
          }}
        >
          {acertos}
        </div>
      )}

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 font-mono font-black tabular-nums text-[#c8102e]"
        style={{
          ...posicaoNoPalco(caixaTempo.x, caixaTempo.y),
          fontSize: fonte(caixaTempo.tamanho),
        }}
      >
        {formatarTempo(tempo)}
      </div>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          ...posicaoNoPalco(barra.x, barra.y),
          width: `${barra.largura}%`,
        }}
      >
        <div className="mb-3 flex items-baseline justify-between text-3xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
          <span>JARRA</span>
          <span className="tabular-nums">{Math.round(nivel * 100)}%</span>
        </div>
        <div className="h-10 overflow-hidden rounded-full bg-black/50 ring-4 ring-white/40">
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

O vermelho `#c8102e` é o dos rótulos já desenhados no fundo da Red Bull: o valor
tem que combinar com o rótulo acima dele.

- [ ] **Step 3: Passar o tema e os acertos ao `Hud`**

Em `web/app/totem/page.tsx`, apague o import de `ARTE` e troque a chamada:

```tsx
        <Hud
          tema={tema}
          acertos={acertos}
          nivel={nivelDeEnchimento(acertos)}
          tempo={tempo}
          venceu={fase === "venceu"}
        />
```

- [ ] **Step 4: Reescrever `web/app/totem/Calibrador.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import type { Tema } from "@/lib/temas";

const LINHAS = Array.from({ length: 19 }, (_, i) => (i + 1) * 100);

type Peca = "pontos" | "tempo" | "nivel";

export function Calibrador({ tema }: { tema: Tema }) {
  const [hud, setHud] = useState(tema.hud);
  const [peca, setPeca] = useState<Peca>("tempo");
  const palco = useRef<HTMLDivElement>(null);
  const arrastando = useRef(false);

  function mover(e: React.PointerEvent) {
    if (!arrastando.current || !palco.current) return;
    const caixa = palco.current.getBoundingClientRect();
    // A caixa ja vem escalada, entao a divisao devolve percentual correto sem
    // que este componente saiba nada sobre a escala do palco.
    const x = Number((((e.clientX - caixa.left) / caixa.width) * 100).toFixed(2));
    const y = Number((((e.clientY - caixa.top) / caixa.height) * 100).toFixed(2));

    // Ramo explicito em vez de chave computada: `{ ...h, [peca]: ... }` perde o
    // tipo e o `npm run typecheck` reclama.
    setHud((h) => {
      if (peca === "nivel") return { ...h, nivel: { ...h.nivel, x, y } };
      if (peca === "tempo") return { ...h, tempo: { ...h.tempo, x, y } };
      if (!h.pontos) return h;
      return { ...h, pontos: { ...h.pontos, x, y } };
    });
  }

  const disponiveis: Peca[] = hud.pontos
    ? ["pontos", "tempo", "nivel"]
    : ["tempo", "nivel"];

  const saida = JSON.stringify(hud, null, 2).replace(/"([^"]+)":/g, "$1:");

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

      {disponiveis.map((nome) => {
        const alvo = nome === "pontos" ? hud.pontos : hud[nome];
        if (!alvo) return null;
        return (
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
            style={{ left: `${alvo.x}%`, top: `${alvo.y}%` }}
          >
            {nome}
          </div>
        );
      })}

      <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-8 text-white">
        <p className="mb-4 text-3xl">
          Tema <b className="text-cyan-300">{tema.nome}</b> — arraste cada peça.
          Editando: <b className="text-cyan-300">{peca}</b>
        </p>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(`hud: ${saida},`)}
          className="mb-6 rounded-2xl bg-cyan-500 px-8 py-5 text-3xl font-bold text-black"
        >
          copiar
        </button>
        <pre className="max-h-72 overflow-auto rounded-2xl bg-[#09090b] p-6 text-2xl text-cyan-200">
          {`hud: ${saida},`}
        </pre>
        <p className="mt-4 text-2xl text-white/50">
          Cole em lib/temas/{tema.nome}.ts e recarregue.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Passar o tema ao calibrador**

Em `web/app/totem/page.tsx`:

```tsx
        {calibrando && <Calibrador tema={tema} />}
```

- [ ] **Step 6: Typecheck, lint e testes**

```bash
cd web
npm run typecheck
npx eslint components lib app
npm test
```
Expected: tudo limpo; nenhuma referência sobrando a `@/lib/totem/arte`.

- [ ] **Step 7: Calibrar o tema da Red Bull**

```bash
npm run dev -- --port 3001
```
Abra `http://localhost:3001/totem?calibrar`. Arraste `pontos` para dentro da
caixa PONTOS, `tempo` para dentro da caixa TEMPO e `nivel` para onde a barra
deve ficar. Clique **copiar** e cole o bloco `hud` em `lib/temas/redbull.ts`.

Repita em `http://localhost:3001/totem?tema=oleo&calibrar` se as posições do
tema do óleo precisarem de ajuste, colando em `lib/temas/oleo.ts`.

Os testes de coordenadas continuam passando desde que tudo fique entre 0 e 100.

- [ ] **Step 8: Commit**

```bash
cd ..
git add web/lib/totem web/app/totem
git commit -m "feat(temas): HUD e calibracao por tema"
```

---

## Verificação final

- [ ] `npm test` verde, com os 11 testes de tema somados aos que já existiam.
- [ ] `npm run typecheck` sem erro.
- [ ] `npx eslint components lib app` sem erro.
- [ ] `npm run build` sem erro.
- [ ] `/totem` mostra fundo Red Bull, lata e números dentro das caixas.
- [ ] `/totem?tema=oleo` mostra cenário, galão e óleo escuro.
- [ ] `/totem?tema=xpto` cai no padrão sem quebrar.
- [ ] As gotas nascem na boca da lata, com ela inclinada em qualquer ângulo.
- [ ] Partidas seguidas sorteiam latas diferentes.
- [ ] `git log --oneline` mostra um commit por task.
