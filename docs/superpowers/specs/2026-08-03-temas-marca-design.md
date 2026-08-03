# Temas de marca: Red Bull e óleo

Data: 2026-08-03

## Objetivo

O jogo de derramar passa a trocar de marca por configuração. Um tema define o
recipiente, o fundo do totem, a cor do líquido e onde o HUD cai sobre a arte.

Dois temas nascem juntos:

- **`redbull`** — lata fotográfica, fundo azul da marca, líquido âmbar. É o
  padrão.
- **`oleo`** — o galão modelado em código e o líquido escuro, como está hoje.

O galão não é descartado: ele vira um tema. Trocar de cliente passa a ser
escrever um arquivo, não mexer na cena.

## Origem dos assets

Os arquivos vêm de `brand-ninja2/public/logos/`, um projeto do mesmo autor:

| Arquivo original | Destino | Tamanho |
|---|---|---|
| `fundo red bull.png` | `public/temas/redbull/fundo.png` | 720 × 1280 |
| `lata 01.png` … `lata 12.png` | `public/temas/redbull/lata-01.png` … `lata-12.png` | 1000 × 1600 |

Os arquivos são **copiados**, não referenciados de fora: um caminho para outro
projeto quebra no primeiro deploy.

Os nomes perdem espaços e acentos. Espaço em URL funciona, mas exige escape e
transforma qualquer erro de digitação num 404 silencioso.

**Não são copiados** `bomba.png`, `bomba a.png`, `explosao a.png`,
`coracao.png` e `inicio.png` — pertencem ao jogo de cortar e não têm uso aqui.

## O tipo Tema

```ts
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

export type Tema = {
  nome: string;
  recipiente: Recipiente;
  /** Imagem de fundo do palco do totem, 9:16. */
  fundo: string;
  liquido: { cor: string; emissiva: string };
  /** Posições em percentual do palco de 1080×1920. */
  hud: {
    /** Ausente no tema cujo fundo não tem caixa de pontos. */
    pontos?: { x: number; y: number; tamanho: number };
    tempo: { x: number; y: number; tamanho: number };
    nivel: { x: number; y: number; largura: number };
  };
};
```

O `Recipiente` é união discriminada porque as duas formas são genuinamente
diferentes: uma é foto, a outra é geometria. Um campo opcional em comum
esconderia isso e deixaria a cena cheia de `if`.

## Seleção do tema

`/totem?tema=oleo` escolhe o tema. Sem query, vale `redbull`. Nome desconhecido
cai no padrão em vez de quebrar: um erro de digitação na URL, no dia do evento,
não pode deixar a tela preta.

A rota `/` usa o tema padrão. Ela é a tela de trabalho e não tem seletor.

## A lata

Um plano na cena com a PNG como textura, girando em `rotation.z` junto com o
despejo. Funciona porque a câmera é frontal e o giro acontece no plano da tela:
girar um plano em Z é indistinguível de inclinar uma lata. Só quebraria se a
câmera orbitasse, e ela não orbita.

Três detalhes decidem se o resultado convence:

1. **`meshBasicMaterial`, não `meshStandardMaterial`.** A foto já tem luz e
   sombra embutidas; iluminá-la de novo suja o produto.
2. **`texture.colorSpace = THREE.SRGBColorSpace`.** Sem isso a PNG aparece
   lavada, e o sintoma parece "a arte veio errada" em vez de "faltou uma linha".
3. **`transparent` com `alphaTest`.** Sem `alphaTest` a sombra projetada é o
   retângulo do plano, não o contorno da lata.

A boca da lata fica na **origem do grupo**, pelo mesmo motivo do galão: é de lá
que as gotas nascem e é em torno dela que a peça gira. As PNGs têm margem
transparente, então o tamanho do plano é ajuste visual — o tema guarda `largura`
e `altura`, e mudá-las é editar dois números.

A lata da partida é sorteada entre as 12 a cada rodada nova, junto com o `round`
que a cena já usa para zerar o estado.

## O fundo

`fundo red bull.png` é 720 × 1280 e o palco é 1080 × 1920: **upscale de 1,5×**.
A proporção é exata, então não há corte nem faixa — só perda de nitidez. Num
totem visto a dois metros não aparece; de perto, aparece. Trocar por um arquivo
maior é substituir o PNG.

O fundo **já traz os rótulos** PONTOS e TEMPO desenhados dentro de caixas
brancas. O HUD renderiza apenas os valores; escrever os rótulos de novo
duplicaria o texto.

## HUD

| Elemento | Tema `redbull` | Tema `oleo` |
|---|---|---|
| Pontos | Gotas acertadas, dentro da caixa PONTOS | Ausente — o fundo não tem a caixa |
| Tempo | Cronômetro, dentro da caixa TEMPO | Cronômetro |
| Nível | Barra com rótulo JARRA e porcentagem | Igual |

`hud.pontos` é opcional: o `Hud` só desenha o número se o tema declarar onde ele
cai. Assim um tema sem caixa de pontos não precisa inventar uma coordenada.

As coordenadas de cada elemento vivem no tema, porque cada fundo põe as caixas
em lugares diferentes. `/totem?calibrar` calibra o **tema ativo** e imprime o
bloco `hud` daquele tema.

## Absorção do `lib/totem/arte.ts`

O `ARTE` global deixa de existir: as coordenadas passam a ser por tema. É o
custo real desta mudança, e atinge `Hud.tsx`, `Calibrador.tsx` e `page.tsx`.

`posicaoNoPalco` sobrevive — é um utilitário genérico, não configuração. O
arquivo é renomeado para `lib/totem/posicao.ts`, com os testes que já tem.

## Testes

Só função pura:

- **`resolverTema`** — nome conhecido devolve o tema certo; nome desconhecido e
  `undefined` devolvem o padrão; o padrão é `redbull`.
- **`sortearLata`** — devolve uma das imagens listadas; funciona com lista de um
  item só; sorteio injetável, para o teste não depender de `Math.random`.
- **Coordenadas** — todo tema registrado tem `hud` com `x` e `y` entre 0 e 100.
  Um tema novo com coordenada fora do palco põe o número fora da tela, e isso só
  apareceria no evento.

`posicaoNoPalco`, `escalaDoPalco` e os 9 testes do galão continuam valendo.

## Fora de escopo

Trocar a jarra alvo por um copo da marca. Seletor de tema no painel do operador.
Som, logo animado, vinheta de vitória com marca. Alterar `pour.ts`, a física, o
contrato BLE ou o firmware. Copiar os assets do jogo de cortar.
