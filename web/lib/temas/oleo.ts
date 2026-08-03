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
