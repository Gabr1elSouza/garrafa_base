import type { Tema } from "./tipos";

const LATAS = Array.from(
  { length: 12 },
  (_, i) => `/temas/redbull/lata-${String(i + 1).padStart(2, "0")}.png`,
);

export const redbull: Tema = {
  nome: "redbull",
  // A PNG tem margem transparente em volta da lata, entao estas medidas sao do
  // plano inteiro e nao do produto. Ajuste visual esperado.
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
