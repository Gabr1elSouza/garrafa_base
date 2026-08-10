import type { Tema } from "./tipos";

/**
 * O copo esta pintado no `fundo.png` com o interior transparente, entao nem o
 * alvo nem o liquido sao escolhidos: sao medidos na arte.
 *
 * Medidas (arte 720x1280): centro x=369, boca y=787, base y=1252, largura
 * interna na boca 257 px. Com a camera do totem o plano z=0 mostra
 * 10.364 x 5.830 unidades e o centro da tela cai em (0, 3.0), de onde
 *
 *   x = (pctX - 50)/100 * 5.830        y = 3.0 - (pctY - 50)/100 * 10.364
 *
 * `chao` desce ate a linha da mesa. Sem isso a sombra da lata cairia no meio do
 * copo, porque o chao da cena esta em y=0 e a base do copo esta bem abaixo.
 */
export const redbull: Tema = {
  nome: "redbull",
  recipiente: {
    tipo: "modelo",
    arquivo: "/temas/redbull/red_bull.glb",
    altura: 2.9,
  },
  // A lata pendura a partir do bico, entao o bico sobe junto com ela: 4.9 - 2.9
  // deixa a base em 2.0, com folga sobre o aro do copo (1.81).
  bocal: 4.9,
  // Luz de foto de produto, para a lata 3D conviver com as fotografadas na
  // arte. Quem faz o trabalho pesado e o reflexo: o painel prateado e um
  // espelho, e o que ele mostra e o ambiente, nao a luz direta.
  luz: {
    ambiente: 0.25,
    principal: 1.1,
    // De frente, do lado da camera: abre o lado escuro do rotulo impresso, que
    // e a parte da lata que responde a luz direta.
    preenchimento: { posicao: [0, 5, 9], intensidade: 35, cor: "#ffffff" },
    reflexo: 1.9,
  },
  fundo: "/temas/redbull/fundo.png",
  // Aproxima o proprio gradiente da arte: e o que se ve pelo copo vazio, do
  // azul na altura da boca ate a mesa clara embaixo.
  backdrop:
    "linear-gradient(to bottom, #94bde2 0%, #94bde2 58%, #b9d4ea 78%, #dfeaf2 93%, #9aa7b4 100%)",
  liquido: { cor: "#f0b429", emissiva: "#8a5a08" },
  alvo: { x: 0.07, y: 1.81, raio: 1.04, chao: -1.95 },
  // 96.5% e o piso interno do copo. O aro esta em 61.5%, mas o liquido cheio
  // para em 66%: copo cheio ate a borda parece prestes a derramar, e o vao
  // ainda deixa ver o vidro por cima da bebida.
  deposito: { onde: "arte", base: 96.5, topo: 66 },
  hud: {
    // As caixas PONTOS e TEMPO ja vem desenhadas no fundo; aqui so os valores.
    pontos: { x: 16, y: 13, tamanho: 4 },
    tempo: { x: 84, y: 13, tamanho: 4 },
    nivel: { x: 50, y: 90, largura: 70 },
    rotulo: "COPO",
    vitoria: "COPO CHEIO!",
  },
};
