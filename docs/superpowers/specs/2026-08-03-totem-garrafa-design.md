# Totem 1080×1920 — Encha a Jarra sobre arte própria

Data: 2026-08-03

## Objetivo

Uma segunda tela do jogo de derramar, `/totem`, desenhada para um painel
vertical de **1080×1920** exposto ao público. A cena 3D continua sendo o jogo;
o que muda é o enquadramento, o cenário e a operação:

- a arte do evento aparece **atrás** da cena, que passa a renderizar sobre fundo
  transparente;
- o HUD encolhe para o essencial e é posicionado sobre a arte;
- a partida se reinicia sozinha, sem ninguém tocar na máquina entre um jogador e
  o próximo.

O `app/page.tsx` atual — barra lateral, placar completo, enquadramento 4:3 —
continua funcionando e não é alterado. É a reserva do evento.

## Restrições do projeto

- **Next.js 16.2.12.** O `web/AGENTS.md` avisa que esta versão tem mudanças que
  quebram em relação a versões anteriores e manda ler
  `node_modules/next/dist/docs/` antes de escrever código. A leitura é
  obrigatória e vem depois do `npm install`, que ainda não foi feito neste
  repositório.
- TypeScript, Tailwind v4 e vitest, como o resto do `web/`.
- O repositório **não está sob git**.

## Escopo da camada viva

Sobre a arte, e só:

1. **Nível da jarra** — barra e porcentagem.
2. **Tempo** — cronômetro, contando desde a primeira gota.
3. **Tela de vitória** — anúncio grande com o tempo final.

Fora de escopo: mira, ranking, nome de jogador, som, histórico entre partidas.

## Palco de tamanho fixo

O conteúdo vive numa caixa de **1080×1920 px fixos**, escalada por
`transform: scale(s)` com `transform-origin: top left`, centrada na viewport:

```
s = min(larguraDaViewport / 1080, alturaDaViewport / 1920)
```

No painel real `s = 1`. Num notebook a caixa encolhe inteira e nenhum
alinhamento entre arte e HUD se desfaz.

O cálculo mora em `lib/totem/palco.ts`. CSS puro não serve: `scale()` exige
número sem unidade e `calc()` não divide comprimento por comprimento.

## Camadas

De trás para frente, dentro do palco:

1. `<img>` com a arte, cobrindo os 1080×1920
2. `<Canvas>` com fundo transparente, cobrindo o palco inteiro
3. HUD e tela de vitória, em HTML e Tailwind

## Mudanças no `PourScene`

O arquivo hoje acumula três responsabilidades: geometria, física e
enquadramento. A separação abaixo é o mínimo para o totem existir sem duplicar a
cena, e não altera o comportamento da tela atual.

- `Cena` passa a ser exportada e recebe `ambiente: "estudio" | "aberto"`.
- `"estudio"` é o comportamento atual — chão opaco `#131319` e `fog` — e
  continua sendo o padrão. `PourScene` não muda, e `/` renderiza igual.
- `"aberto"` troca o chão opaco por um plano com `shadowMaterial` e **não
  renderiza o `fog`**.
- `PourScene` continua embrulhando `Cena` no Canvas 4:3 de hoje.
- O totem monta o próprio Canvas, retrato e transparente.

O chão opaco e o fog existem para o jogo não parecer flutuando no vazio. Com a
arte atrás, os dois tapariam justamente o que se quer mostrar. O
`shadowMaterial` preserva a sombra projetada — que é o que ancora as garrafas no
cenário — enquanto deixa a arte aparecer. A perda de profundidade que o fog dava
foi aceita explicitamente.

## Enquadramento retrato

A área jogável vai de `x ≈ ±2.6` (percurso do oscilador mais o raio da garrafa)
e de `y = 0` (base da jarra) a `y ≈ 6.0` (topo da garrafa de cima).

Num palco 9:16 com `fov` vertical de 42°, a largura visível é cerca de `0.43 × d`.
Cobrir 5,2 unidades de largura exige `d ≈ 13`.

Valores de partida: câmera em `[0, 3.2, 13.5]`, `fov` 42, olhando para
`(0, 3.0, 0)`. São ponto de partida para ajuste visual, não medida final.

## Ciclo da partida

```
pronto → (primeira gota) → jogando → (jarra cheia) → vitória
   ↑                                                    │
   └──────────────── 8 s depois, sozinho ───────────────┘
```

A partida começa na primeira gota derramada, não num botão — é o que já
acontece hoje, e faz o cronômetro medir só tempo de jogo. O reinício automático
é o que permite a fila andar sem operador.

## Operador

**Desconectado** — botões grandes centrados: **Conectar garrafa** e **Usar
simulador**, mais o aviso de navegador sem Web Bluetooth.

**Conectado** — some tudo; fica a arte, a cena e o HUD.

**Reabrir** — área invisível de 160×160 px no canto superior direito. O painel
traz **Marcar posição atual como 0°**, **Desconectar** e, no simulador, o botão
de derramar.

O "marcar 0°" não é opcional neste jogo: a inclinação é medida a partir de uma
pose de referência, e sem recalibrar entre pessoas o jato abre na hora errada.

O botão de conectar precisa estar nesta tela, e não em outra: o Web Bluetooth
exige que `requestDevice()` saia de um gesto do usuário na própria página.

## Arquivos

```
web/app/totem/page.tsx        a tela
web/app/totem/CenaTotem.tsx   Canvas retrato e transparente
web/app/totem/Hud.tsx         nivel, tempo e tela de vitoria
web/app/totem/Operador.tsx    conectar, zerar 0°, desconectar
web/app/totem/Calibrador.tsx  overlay do modo ?calibrar
web/lib/totem/palco.ts        escalaDoPalco + usePalco
web/lib/totem/palco.test.ts
web/lib/totem/arte.ts         coordenadas + posicaoNoPalco
web/lib/totem/arte.test.ts
web/lib/totem/ambiente.ts     useContextoSeguro
web/public/totem/cenario.svg  placeholder ate a arte definitiva
```

Modificado: `web/components/PourScene.tsx`, só para exportar `Cena` e aceitar
`ambiente`.

A tela de vitória não tem coordenada: ela cobre o palco inteiro.

## Coordenadas e calibração

As posições do HUD ficam num arquivo só, em percentual do palco:

```ts
export const ARTE = {
  imagem: "/totem/cenario.svg",
  nivel: { x: 50, y: 88, largura: 60 },
  tempo: { x: 50, y: 8, tamanho: 5 },
};
```

`/totem?calibrar` sobrepõe uma grade de 100 px e deixa arrastar cada elemento do
HUD, imprimindo o objeto pronto para colar. A calibração não persiste em
`localStorage`: duas fontes de verdade para a mesma coordenada, e a que está no
navegador do dia do evento é a que ninguém consegue auditar.

## Arte

Requisito: **1080×1920 exatos**. Outra proporção aparece esticada — a imagem
cobre o palco sem recorte inteligente.

Entra um **placeholder SVG de 1080×1920**: fundo escuro, um chão sugerido e uma
faixa de topo, o suficiente para conferir que a cena transparente compõe com o
que está atrás. É substituído trocando o arquivo em `public/totem/`.

## Erros

| Situação | Resposta |
|---|---|
| Navegador sem Web Bluetooth | Explica e oferece o simulador, dentro do painel |
| Página aberta em `192.168.x.x` | Avisa que o BLE só funciona em `localhost` |
| Usuário fecha o seletor de dispositivo | Volta a "desconectado", sem banner |
| Garrafa cai no meio da partida | Painel reabre sozinho com o aviso |
| Arquivo de arte não carrega | Fundo escuro neutro; a cena continua jogável |

Banner sobre a arte no meio do evento é pior que o próprio erro: a queda de
conexão já reabre o painel, que é onde a mensagem cabe.

## Testes

`vitest`, já configurado. Só função pura:

- **`escalaDoPalco`** — 1080×1920 dá 1; janela larga demais limita pela altura;
  janela alta demais limita pela largura; medida inválida devolve 1.
- **`posicaoNoPalco`** — converte percentual em `left`/`top`, com clamp fora de
  0–100.

`lib/game/pour.ts` já tem os testes dele e não é tocado. A física não muda.

## Fora de escopo

Substituir o `app/page.tsx`. Alterar o firmware, o contrato BLE ou `pour.ts`.
Mira, ranking, som, múltiplos totens sincronizados, deploy remoto. Suporte a
navegador sem Web Bluetooth além do que o simulador já cobre.
