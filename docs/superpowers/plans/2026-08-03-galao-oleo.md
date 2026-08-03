# Galão de óleo no lugar da garrafa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o molde da garrafa de despejar por um galão de óleo de carro tipo "F", e o líquido âmbar por óleo escuro.

**Architecture:** As geometrias do galão saem para um módulo próprio, `web/components/galao.ts`, como funções puras que devolvem geometrias **já posicionadas** no sistema de coordenadas do bico — bico em `(0,0,0)`, corpo pendurado abaixo e à esquerda. `PourScene` deixa de construir a garrafa e passa a renderizar quatro meshes sem `position`. A física em `lib/game/pour.ts` não é tocada.

**Tech Stack:** three.js, @react-three/fiber, TypeScript, vitest.

## Global Constraints

- **O bico fica em `(0, 0, 0)`.** É a origem de rotação e o ponto de nascimento das gotas (`nascerGota()` usa a posição do grupo). Se escorregar, o jato passa a sair do ar ao lado do bico, sem erro nenhum.
- **Não modificar:** `web/lib/game/pour.ts`, `web/lib/spin-source/**`, `web/app/page.tsx`, `web/app/totem/**`, `web/components/StatusBar.tsx`, o firmware ou o contrato BLE.
- **Não tocar em `useGeometriaAlvo`** (a jarra alvo) nem no enquadramento da câmera — fora de escopo.
- **Altura total do galão ~2,0 unidades**, igual à garrafa de hoje, para não desequilibrar com a jarra alvo.
- **Corpo achatado:** profundidade menor que a largura. É o que dá silhueta de galão em vez de garrafão.
- **Cor do óleo numa constante nomeada**, nunca literal espalhado pela cena.
- **Idioma:** nomes e comentários em português, seguindo o repositório. Comentários só onde explicam *por quê*.
- Todo comando roda em `web/`, não na raiz do repositório.
- O trabalho continua no branch `totem-garrafa`, que já existe.

## Medidas

Sistema de coordenadas do bico: `y = 0` é a boca, `y` negativo desce.

| Peça | Faixa em Y | Centro | Tamanho |
|---|---|---|---|
| Tampa | 0 a −0,08 | (0; −0,04) | raio 0,16 |
| Gargalo | −0,08 a −0,36 | (0; −0,22) | raio 0,13 |
| Corpo | −0,36 a −1,86 | (−0,33; −1,11) | 1,0 × 1,5 × 0,5 |
| Alça | −0,54 a −1,16 | (−0,90; −0,85) | 0,42 × 0,62 × 0,30 |

O corpo vai de `x = −0,83` a `x = +0,17`: o gargalo em `x = 0` fica a 0,17 da
borda direita. A alça encosta na borda esquerda com 0,14 de sobreposição, para
não ficar uma peça solta flutuando ao lado.

---

### Task 1: Geometrias do galão

Entrega: `web/components/galao.ts` produz as quatro geometrias posicionadas, com teste garantindo que o bico está na origem.

**Files:**
- Create: `web/components/galao.ts`
- Test: `web/components/galao.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `GALAO` — objeto com as medidas
  - `COR_OLEO = "#3a2410"`, `COR_OLEO_EMISSIVA = "#140b03"`
  - `criarCorpo(): THREE.ExtrudeGeometry`
  - `criarAlca(): THREE.ExtrudeGeometry`
  - `criarGargalo(): THREE.CylinderGeometry`
  - `criarTampa(): THREE.CylinderGeometry`

  As quatro devolvem a geometria **já transladada** para o sistema do bico. Quem
  renderiza não passa `position`.

- [ ] **Step 1: Escrever o teste que falha**

Create `web/components/galao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { criarAlca, criarCorpo, criarGargalo, criarTampa } from "./galao";

/** Caixa envolvente de uma geometria ja posicionada. */
function caixa(geo: THREE.BufferGeometry): THREE.Box3 {
  geo.computeBoundingBox();
  return geo.boundingBox as THREE.Box3;
}

describe("galao", () => {
  it("poe a boca da tampa na origem", () => {
    const c = caixa(criarTampa());
    expect(c.max.y).toBeCloseTo(0, 2);
  });

  it("centra a tampa no eixo, para o jato sair do bico", () => {
    const c = caixa(criarTampa());
    const centro = new THREE.Vector3();
    c.getCenter(centro);
    expect(centro.x).toBeCloseTo(0, 2);
    expect(centro.z).toBeCloseTo(0, 2);
  });

  it("nao deixa nenhuma peca subir acima do bico", () => {
    for (const geo of [criarCorpo(), criarAlca(), criarGargalo(), criarTampa()]) {
      expect(caixa(geo).max.y).toBeLessThanOrEqual(0.001);
    }
  });

  it("pendura o corpo abaixo, terminando perto de -1.86", () => {
    const c = caixa(criarCorpo());
    expect(c.min.y).toBeCloseTo(-1.86, 1);
    expect(c.max.y).toBeLessThan(-0.3);
  });

  it("faz o corpo mais largo que profundo: a silhueta e achatada", () => {
    const c = caixa(criarCorpo());
    const largura = c.max.x - c.min.x;
    const profundidade = c.max.z - c.min.z;
    expect(largura).toBeGreaterThan(profundidade * 1.5);
  });

  it("centra o corpo na profundidade", () => {
    // Pega o erro de centrar pelo numero errado depois do bisel: a peca fica
    // torta em Z por uma fracao que nenhum outro teste enxerga.
    const centro = new THREE.Vector3();
    caixa(criarCorpo()).getCenter(centro);
    expect(centro.z).toBeCloseTo(0, 2);
  });

  it("desloca o corpo para a esquerda do bico", () => {
    const centro = new THREE.Vector3();
    caixa(criarCorpo()).getCenter(centro);
    expect(centro.x).toBeLessThan(-0.2);
  });

  it("poe a alca do lado oposto ao gargalo", () => {
    const centro = new THREE.Vector3();
    caixa(criarAlca()).getCenter(centro);
    expect(centro.x).toBeLessThan(-0.6);
  });

  it("vaza a alca: o furo tira volume do meio", () => {
    const comFuro = criarAlca().attributes.position.count;
    expect(comFuro).toBeGreaterThan(0);
    const c = caixa(criarAlca());
    // A alca e mais alta que larga: e uma argola vertical, nao um bloco.
    expect(c.max.y - c.min.y).toBeGreaterThan(c.max.x - c.min.x);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd web
npx vitest run components/galao.test.ts
```
Expected: FAIL — `Cannot find module './galao'`.

- [ ] **Step 3: Implementar `web/components/galao.ts`**

```ts
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
 * Duas correcoes que o ExtrudeGeometry exige e que passam despercebidas:
 * o bisel cresce para fora nos dois lados, entao a extrusao desconta o dobro
 * dele; e a peca resultante vai de -bisel ate depth+bisel, cujo centro e
 * `depth/2` — nao `profundidade/2`. Centrar pelo numero errado deixa a peca
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
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run components/galao.test.ts
```
Expected: PASS, 9 testes.

- [ ] **Step 5: Typecheck, suíte inteira e commit**

```bash
npm run typecheck
npm test
npx eslint components/galao.ts components/galao.test.ts
cd ..
git add web/components/galao.ts web/components/galao.test.ts
git commit -m "feat(cena): geometrias do galao de oleo, com o bico na origem"
```

---

### Task 2: Montar o galão na cena e escurecer o óleo

Entrega: a cena mostra o galão de plástico opaco despejando óleo escuro, em `/` e em `/totem`.

**Files:**
- Modify: `web/components/PourScene.tsx`

**Interfaces:**
- Consumes: `criarCorpo`, `criarAlca`, `criarGargalo`, `criarTampa`, `COR_OLEO`, `COR_OLEO_EMISSIVA` (Task 1).
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Trocar o construtor da garrafa pelo do galão**

Em `web/components/PourScene.tsx`, remova a função `useGeometriaGarrafa()`
inteira (o `perfil`, o `LatheGeometry` e o `g.translate(0, -2.0, 0)`).

Troque o import do topo, acrescentando:

```tsx
import {
  COR_OLEO,
  COR_OLEO_EMISSIVA,
  criarAlca,
  criarCorpo,
  criarGargalo,
  criarTampa,
} from "./galao";
```

Dentro de `Cena`, troque a linha `const geoGarrafa = useGeometriaGarrafa();` por:

```tsx
  const geoCorpo = useMemo(() => criarCorpo(), []);
  const geoAlca = useMemo(() => criarAlca(), []);
  const geoGargalo = useMemo(() => criarGargalo(), []);
  const geoTampa = useMemo(() => criarTampa(), []);
```

- [ ] **Step 2: Atualizar o descarte das geometrias**

Troque o efeito de limpeza para soltar as quatro peças novas:

```tsx
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
```

- [ ] **Step 3: Renderizar as quatro peças**

Troque o bloco do grupo da garrafa por:

```tsx
      {/* Galao de cima: o grupo fica na altura do bico e gira em torno dele.
          Nenhuma peca leva `position` — elas ja saem posicionadas de galao.ts. */}
      <group ref={garrafa} position={[0, ALTURA_BOCAL, 0]}>
        <mesh geometry={geoCorpo} castShadow>
          <meshStandardMaterial color="#d7d9d4" roughness={0.55} />
        </mesh>
        <mesh geometry={geoAlca} castShadow>
          <meshStandardMaterial color="#d7d9d4" roughness={0.55} />
        </mesh>
        <mesh geometry={geoGargalo} castShadow>
          <meshStandardMaterial color="#c9ccc6" roughness={0.6} />
        </mesh>
        <mesh geometry={geoTampa} castShadow>
          <meshStandardMaterial color="#b03a2e" roughness={0.45} />
        </mesh>
      </group>
```

A tampa vermelha não é enfeite: ela marca onde é o bico, que num galão fica no
canto e não no centro. Sem ela a peça fica ambígua de longe.

- [ ] **Step 4: Escurecer o líquido na jarra e as gotas**

Troque o material do líquido acumulado:

```tsx
        <meshStandardMaterial
          color={COR_OLEO}
          roughness={0.25}
          emissive={COR_OLEO_EMISSIVA}
          emissiveIntensity={0.35}
        />
```

E o das gotas, dentro do `instancedMesh`:

```tsx
        <meshStandardMaterial
          color={COR_OLEO}
          roughness={0.2}
          emissive={COR_OLEO_EMISSIVA}
          emissiveIntensity={0.3}
        />
```

- [ ] **Step 5: Typecheck, lint e testes**

```bash
cd web
npm run typecheck
npx eslint components lib app
npm test
```
Expected: tudo limpo; a contagem de testes é a da Task 1.

- [ ] **Step 6: Conferir no navegador**

```bash
npm run dev -- --port 3001
```

Abra `http://localhost:3001/` e `http://localhost:3001/totem`. Conecte no
simulador e derrame (espaço em `/`, botão no painel do totem). Confira:

1. a peça de cima é um galão achatado, com alça vazada à esquerda e bico com
   tampa vermelha no canto direito;
2. ao inclinar, ele gira **em torno do bico** — a tampa fica quase parada e o
   corpo é que sobe;
3. as gotas **nascem no bico**, não ao lado dele;
4. o óleo é escuro e a jarra escurece conforme enche.

O item 3 é o que o teste da Task 1 protege; esta é a confirmação visual dele.

Se as proporções ficarem estranhas, os números vivem todos em `GALAO`, em
`components/galao.ts` — nenhuma medida está espalhada pela cena.

- [ ] **Step 7: Commit**

```bash
cd ..
git add web/components/PourScene.tsx
git commit -m "feat(cena): galao de oleo no lugar da garrafa, com oleo escuro"
```

---

## Verificação final

- [ ] `npm test` verde, com os 9 testes novos somados aos 53 que já existiam.
- [ ] `npm run typecheck` sem erro.
- [ ] `npx eslint components lib app` sem erro.
- [ ] `npm run build` sem erro.
- [ ] `/` e `/totem` mostram o galão; nenhuma outra mudança visual nas duas telas.
- [ ] O jato nasce no bico, com o galão inclinado em qualquer ângulo.
- [ ] `git log --oneline` mostra um commit por task.
