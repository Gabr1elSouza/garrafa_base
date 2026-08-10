# Lata 3D girando no eixo, e o copo da arte como alvo

Data: 2026-08-10

## Problema

Na rota `/totem` a lata que despeja é uma foto num plano (`components/Lata.tsx`),
sorteada entre doze PNGs por partida. Um plano só gira no plano da tela, então a
lata inclina para despejar mas não tem como girar em torno do próprio eixo — o
sprite viraria uma linha.

O `redbull-giro-main` tem o que falta: `public/red_bull.glb` e um componente que
já resolve os dois problemas de um `.glb` baixado do Sketchfab (conversão de
eixos e recentragem do pivô pela bounding box).

Ao mesmo tempo, a arte de fundo do tema `redbull` mudou: agora tem um copo com
gelo desenhado, e é ele que deve encher. A jarra 3D que a cena desenha no centro
virou um segundo recipiente concorrendo com o copo pintado.

## O que muda

A lata passa a ser o modelo 3D, girando em torno do próprio eixo pelo `angle` do
sensor e inclinando pelo `tilt`, ao mesmo tempo. O alvo passa a ser o copo da
arte: a jarra 3D sai de cena no tema `redbull` e o líquido é posicionado dentro
do copo desenhado.

## O que não muda

O vaivém horizontal continua automático (`posicaoOscilador`). O giro é só
visual: não move a lata, não mira, não pontua. A dificuldade do jogo continua
sendo "acerte o tempo do vaivém".

## Origem dos dados

O firmware da garrafa já manda tudo que é preciso, no mesmo pacote de 8 bytes:

- `angle` — 0..360, integração do giroscópio Z do sensor (`yaw += gzUtil * dt`).
  Com o sensor montado com o Z ao longo do eixo da lata, é o giro no próprio
  eixo, e continua válido com a lata inclinada.
- `tilt` — 0..180 a partir da pose de repouso, do filtro complementar.

Não há mudança de firmware, nem o protocolo de quaternion do `redbull-giro-main`
é necessário. Hoje o `/totem` simplesmente descarta o `angle`.

## Arquitetura

### Hierarquia de grupos

```
<group ref={garrafa} position={[0, ALTURA_BOCAL, 0]}>   oscila em X, inclina em Z
  └── <group ref={giro}>                                 gira em Y
        └── <LataModelo />                               pivô na boca, x/z centrados
```

O giro é o grupo **interno**. Assim ele acontece no referencial local da lata, e
ela continua girando em torno do próprio eixo longo mesmo já inclinada. Se o
giro fosse o grupo externo, inclinar faria a lata orbitar em vez de girar.

### Pivô do modelo

Diferente do `RedBullCan.tsx` do outro projeto, que centra o modelo nos três
eixos porque o demo de atitude gira em torno do centro. Aqui:

- x e z centrados pela bounding box — senão o giro descreve um cone;
- y deslocado para o **topo** do modelo encostar na origem do grupo, porque é da
  boca que as gotas saem e é em torno dela que a inclinação gira. É o mesmo que
  o sprite já fazia com `position={[0, -altura/2, 0]}`.

Não se aplica a rotação de 90° em X que o `RedBullCan.tsx` usa: aquilo converte
para o referencial Z-up do sensor do outro projeto. O nó raiz do `.glb` já
carrega a matriz que põe a lata em pé no Y (base em `y=0`, topo em `y=5.535`,
centrada em x/z), e a cena da garrafa é Y-up puro.

A parte calculável sai como função pura em `lib/temas/modelo.ts`
(`ajusteDoModelo`), para ser testável sem WebGL.

### A altura do bico anda junto com o tamanho da lata

Consequência do pivô: a lata pendura a partir do bico, então crescer sem subir o
bico afunda a base dela dentro do copo. Com `altura: 2.16` a base ficava em
1,84, encostando no aro (1,81) — não havia folga nenhuma para crescer.

Por isso `ALTURA_BOCAL` vira `Tema.bocal` (o `oleo` e a rota `/` seguem em 4.0).
No `redbull`, `altura: 2.9` com `bocal: 4.9` deixa a base em 2,0, com folga
sobre o aro, e põe a lata 3D no mesmo porte das latas fotografadas na arte.

Subir o bico alonga a queda de 2,19 para 3,09 unidades, o que dá à gota mais
tempo de arrastar com a inércia do vaivém. O efeito é pequeno, mas é o tipo de
coisa que muda a dificuldade sem avisar. Um teste amarra a relação: para todo
tema com recipiente `modelo`, `bocal - altura` tem de ficar acima de `alvo.y`.

### Suavização do ângulo

`angle` chega 0..360 e dá a volta. Amortecer direto sobre esse número faz o
caminho longo: de 359° para 1° percorre 358° para trás, e a lata dá um solavanco
visível a cada volta. `lib/game/giro.ts` expõe `menorDiferencaAngular(de, para)`,
que devolve o menor caminho em (-180, 180]; o grupo acumula em radianos e
amortece sobre essa diferença.

A constante de suavização é 14. O firmware cai para 4 Hz quando a lata está
quase parada (`PERIODO_OCIOSO = 250 ms`), e sem amortecer o giro lento aparece
em degraus.

### A lata é um espelho, e precisa de algo para refletir

Os dois materiais do `.glb` são metal: `Aluminium` com metalness 1.0 e roughness
0.1, e `Red_Bull` com 0.80. Metal não tem cor própria sob luz difusa — mostra o
que está em volta. Numa cena sem ambiente ele mostra o vazio, e o painel
prateado saía com uma faixa cinza-escura descendo o meio, destoando das latas
fotografadas na arte. Não era falta de luz: aumentar as intensidades não muda
nada, porque não havia o que refletir.

`components/Reflexo.tsx` monta um `RoomEnvironment` — uma sala com painéis de
luz, que já vem no three — passa pelo `PMREMGenerator` e instala como
`scene.environment`. Sem dependência nova, sem HDRI baixado, sem arquivo em
`public`. O PMREM é o que faz a reflexão respeitar a rugosidade do material;
sem ele tudo vira espelho perfeito.

Dois detalhes que custaram um ciclo cada:

1. **Onde os recursos nascem.** Criar o render target no corpo do componente e
   descartá-lo no cleanup parece equivalente a fazer tudo no efeito, mas em
   StrictMode o efeito roda duas vezes e o descarte mata o target que ainda
   está instalado. O sintoma é cruel: `scene.environment` fica apontando para a
   textura certa, o debug confirma que é o mesmo objeto, e mesmo assim nada
   ilumina — nem um ambiente vermelho puro com todas as luzes apagadas. Tudo
   nasce e morre dentro do efeito.

2. **Como escrever na cena.** `useThree((s) => s.scene)` devolve um valor que o
   React Compiler trata como imutável, e `scene.environment = ...` vira erro de
   lint. A saída é `useStore()` e ler `getState()` dentro do efeito, o que
   também deixa a escrita junto do descarte.

A luz vira `Tema.luz`, porque as duas cenas querem coisas opostas: o `redbull` é
foto de produto num fundo claro, o `oleo` é cena noturna e clarear estragaria.
O `oleo` fica sem reflexo, e sem reflexo o componente não instala ambiente
nenhum.

`luz.reflexo` é o único botão do brilho da lata: ainda escura, sobe; rótulo
lavando ou vermelho perdendo saturação, desce. Em 2.2 o painel prateado mede 227
de brilho contra 212 da lata fotografada ao lado, que é onde as duas convivem.

As gotas levam `envMapIntensity` baixo no próprio material. O ambiente é forte
porque a lata precisa dele; gota não é metal, e no mesmo nível o jato lava e sai
creme, destoando do líquido âmbar que se acumula no copo.

### O alvo

Medidas do copo em `public/temas/redbull/fundo.png` (que é 720×1280, não
1080×1920 — mesma proporção, sobe escalado para o palco):

| | pixel | % do palco |
|---|---|---|
| centro x | 369 | 51,2% |
| boca (frente do aro) | 787 | 61,5% |
| base | 1252 | 97,8% |
| largura interna na boca | 257 | 35,7% |

Com a câmera do totem (`[0, 3.2, 13.5]`, fov 42 vertical, `lookAt(0, 3, 0)`,
proporção 9:16) o plano `z = 0` mostra 10,364 × 5,830 unidades e o centro da
tela cai em `(0, 3.0)`. A conversão usada:

```
x = (pctX - 50)/100 * 5.830
y = 3.0 - (pctY - 50)/100 * 10.364
```

Os números resultantes são um ponto de partida medido, não uma verdade: valem
uma conferência visual.

### Alvo por tema

O tema `oleo` aponta para `cenario.svg`, que é `ARTE PLACEHOLDER` e não tem
recipiente desenhado — ele depende da jarra 3D. Então o alvo não pode ser
global: vira campo do tema.

`lib/game/pour.ts` passa a exportar o tipo `Alvo` e a constante `ALVO_JARRA`, e
`passoGota` recebe o alvo em vez de ler constantes de módulo. `Alvo` carrega só
o que a física precisa; como o líquido é desenhado é assunto do tema.

```
                    jarra (oleo)     copo (redbull)
x                   0                0.07
y (boca)            1.62             1.81
raio                0.66             1.04
chao                0                -1.95
```

`chao` é onde a gota perdida morre e onde apoia o recipiente.

### O copo da arte é uma janela, e isso decide a camada do líquido

Descoberto ao rodar: o `fundo.png` tem canal alfa, e o **interior do copo é
semi-transparente** (alfa 68–182) enquanto todo o resto da arte é opaco (255).
O copo é uma janela.

Isso tem duas consequências que mudaram o desenho original:

1. Sem nada opaco atrás, a janela mostra o fundo do palco (`bg-[#09090b]`) e o
   copo vazio vira um buraco preto. O tema ganha `backdrop`, uma camada CSS
   atrás da arte.

2. O líquido **não pode** ser um cilindro 3D. O canvas fica acima da arte, então
   o cilindro passaria por cima do copo e cobriria o gelo. O líquido vira uma
   camada DOM **atrás** do `<img>` — e aí a própria arte o recorta, com o gelo e
   as paredes por cima de graça, sem máscara e sem um segundo canvas.

Por isso o `Tema` ganha `deposito`, que diz onde o recipiente mora e como o
líquido é desenhado:

```ts
type Deposito =
  | { onde: "cena"; fundo: number; raio: number; altura: number }   // cilindro 3D
  | { onde: "arte"; base: number; topo: number };                   // camada 2D, % do palco
```

Na variante `arte` não há largura: fora da janela a arte é opaca, então basta a
faixa vertical. `base: 96.5` é o piso interno do copo. O aro está em 61,5%, mas
`topo: 66` para o líquido 4,5 pontos abaixo dele: cheio até a borda parece
prestes a derramar, e o vão deixa ver o vidro por cima da bebida.

`onde` também decide o que a cena 3D desenha: com `arte` não há jarra, não há
cilindro e não há plano de chão — a arte é uma foto plana com luz própria, e a
sombra projetada da lata caía como uma mancha solta sobre o copo.

### O canvas estava encolhido pela metade

Bug pré-existente, encontrado ao conferir a projeção contra a arte. O palco
inteiro vive dentro de um `transform: scale()`, e o R3F mede o canvas com
`getBoundingClientRect`, que já vem escalada. Ele gravava esse tamanho em pixels
no canvas, e o transform do pai encolhia de novo:

```
palco     layout 1080x1920   visual 618.8x1100   ok
wrapper   layout 1080x1920   visual 618.8x1100   ok
canvas    layout  618.8x1100 visual 354.5x630    <- escalado duas vezes
```

A cena 3D ocupava um pedaço do palco enquanto a arte ocupava tudo. Passava
despercebido porque nada precisava casar com a arte; com o alvo virando o copo
pintado, quebra tudo. A correção é `resize={{ offsetSize: true }}` no `Canvas`,
que mede o layout em vez do retângulo renderizado.

Com isso a projeção bate: a boca do alvo (`y = 1.81`) cai em 61,46% do palco, e
o aro pintado está em 61,48%.

### Dificuldade

O raio de acerto vai de 0,66 para 1,04: a área quase dobra. `GOTAS_PARA_ENCHER`
fica em 130 nesta rodada. Mexer nos dois ao mesmo tempo esconderia qual dos dois
mudou o quê; a reavaliação vem depois de ver na tela.

O teste `existe uma janela de acerto, nem sempre nem nunca` roda contra
`ALVO_JARRA`, então continua medindo a mesma coisa que media antes.

### Giro no simulador

`MockSpinSource.spin()` existia mas nunca era chamado pela interface, só pelos
testes: no simulador o `angle` ficava sempre em 0 e a lata nunca girava. O
painel do operador ganha um botão "Girar lata" quando a fonte é o mock — sem
ele não há como ver o giro sem hardware, nem demonstrar o jogo se o BLE falhar
no evento.

## Remoções

Com o `.glb` único, nenhum tema usa `Recipiente.sprite`. Saem:

- `components/Lata.tsx`
- `sortearLata` e seus testes
- o ramo `sprite` de `Recipiente`

Os doze PNGs continuam em `public/temas/redbull/`, sem referência.

## Testes

Puros, sem WebGL:

- `menorDiferencaAngular` — volta em 360, sinal, extremos, idempotência.
- `ajusteDoModelo` — escala e offset a partir de uma bounding box conhecida,
  incluindo modelo fora do centro em x/z.
- `passoGota` parametrizado — os casos existentes contra `ALVO_JARRA`, mais um
  caso novo confirmando que o raio do copo aceita gota que a jarra recusa, e
  outro de que o chão mais baixo do copo deixa a gota cair mais fundo.
- Coerência dos temas — faixa do líquido dentro do palco e de cabeça para cima,
  líquido da jarra dentro dela, e `backdrop` obrigatório em quem tem recipiente
  na arte (sem ele o copo vazio vira buraco preto).

## Riscos

- O `.glb` tem 6 MB. Carrega atrás de `Suspense`; num totem é uma vez só.
- A arte é 720×1280 num palco de 1080×1920: sobe escalada e fica levemente mole.
  Não é regressão (a arte anterior tinha o mesmo tamanho), mas vale pedir a arte
  em 1080×1920.
- O `yaw` do firmware não tem referência absoluta e deriva devagar. O comando
  `zero` já existe no painel do operador.
