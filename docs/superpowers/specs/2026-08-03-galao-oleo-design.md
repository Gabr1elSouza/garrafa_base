# Galão de óleo no lugar da garrafa

Data: 2026-08-03

## Objetivo

Trocar o molde da garrafa de despejar por um **galão de óleo de carro**, e o
líquido por óleo escuro. Mudança de aparência: a física, o contrato BLE, o
firmware, a jarra alvo, o HUD e as duas rotas ficam como estão.

## Por que não dá para trocar só o perfil

A garrafa de hoje é um sólido de revolução: `LatheGeometry` sobre um perfil 2D
em `useGeometriaGarrafa()`. Um galão de óleo tem três características que a
revolução não produz:

- lados retos e corpo achatado;
- alça vazada;
- bico fora do centro.

Por isso o molde novo é montado de peças extrudadas, e não de um perfil girado.

## Forma

Galão tipo "F", quatro peças. Medidas em unidades de cena, iguais às que a
garrafa atual usa.

| Peça | Construção | Medidas |
|---|---|---|
| Corpo | `Shape` retangular de cantos arredondados, `ExtrudeGeometry` com bisel | 1,0 × 1,5 × 0,5, canto 0,12 |
| Alça | `Shape` anelar (retângulo com furo), extrudado mais fino | 0,42 × 0,62, furo 0,20 × 0,38, profundidade 0,30 |
| Gargalo | Cilindro | raio 0,13, altura 0,28 |
| Tampa | Cilindro | raio 0,16, altura 0,08 |

Altura total ~2,0 — a mesma da garrafa atual, para não desequilibrar com a jarra
alvo, cujo corpo tem raio 0,82.

O corpo é **achatado**: profundidade 0,5 contra 1,0 de largura. É isso que dá a
silhueta de galão em vez de garrafão.

O gargalo fica no canto **superior direito** do corpo e a alça no lado
**esquerdo**. Essa assimetria é o que identifica a peça como galão de óleo; um
galão simétrico lê como jarra.

Os valores acima são ponto de partida para ajuste visual, não medida final.

## O bico na origem

Hoje o código faz `g.translate(0, -2.0, 0)` para pôr o bico na origem. É o que
faz a garrafa girar em torno da boca ao inclinar, como uma garrafa de verdade, e
é de lá que as gotas nascem — `nascerGota()` usa a posição do grupo.

Com quatro peças isso deixa de ser uma translação e passa a ser o **sistema de
coordenadas do conjunto**: cada geometria já sai posicionada em relação ao bico,
que fica em `(0, 0, 0)`. O corpo pendura abaixo e à esquerda.

Se o bico escorregar da origem, a peça gira em torno do lugar errado e o jato
passa a nascer no ar, ao lado do bico. Nada quebra, nada avisa — por isso este é
o único ponto que leva teste.

## Material

| Alvo | Antes | Depois |
|---|---|---|
| Garrafa | `meshPhysicalMaterial` verde translúcido, clearcoat | `meshStandardMaterial` opaco, cinza-claro, `roughness` 0,55 |
| Gotas e líquido na jarra | Âmbar `#f0b429`, emissivo `#8a5a08` | Marrom-escuro de óleo |

A cor do óleo mora numa constante nomeada, para escurecer ou clarear sem caçar
literais pela cena.

**Decisão registrada:** o óleo escuro foi escolhido sabendo que ele custa
legibilidade — gota escura sobre arte escura fica difícil de ver, e a mira do
jato depende dessa leitura. Fica mantido um brilho especular baixo para que as
gotas não virem silhuetas chapadas. O nível da jarra não sofre: o HUD já mostra
barra e porcentagem.

## Onde o código vive

`PourScene.tsx` tem ~280 linhas e mistura geometria, física de gotas e
enquadramento. Um galão de quatro peças piora isso.

As geometrias do galão saem para `web/components/galao.ts` — funções puras que
devolvem as geometrias **já posicionadas** no sistema de coordenadas do bico.
`PourScene` fica com a cena e renderiza quatro meshes sem `position`.

A jarra alvo (`useGeometriaAlvo`) não é tocada e continua onde está: extrair o
que não muda seria refatoração fora do escopo.

## Testes

`galao.test.ts`, sobre as caixas envolventes das geometrias:

- a boca da tampa fica em `y ≈ 0` — o bico está na origem;
- a tampa está centrada em `x ≈ 0`;
- nenhuma peça sobe acima de `y = 0`;
- o corpo pendura abaixo, terminando perto de `y = −1,86`;
- o corpo é mais largo que profundo — a silhueta é achatada, não cilíndrica.

Geometria é visual e quase não se testa. O que se testa aqui é a única
propriedade cuja quebra é silenciosa.

## Fora de escopo

Rótulo, marca ou textura no galão. Modelo `.glb` externo e a dependência
`@react-three/drei`. Mudar a jarra alvo, a física, o HUD, o firmware ou o
contrato BLE. Ajustar o enquadramento da câmera.
