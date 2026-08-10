import { ALTURA_BOCAL, ALVO_JARRA } from "../game/pour";
import type { Tema } from "./tipos";

export const oleo: Tema = {
  nome: "oleo",
  recipiente: { tipo: "galao" },
  fundo: "/totem/cenario.svg",
  // Oleo de motor usado. A emissiva e baixa de proposito: nao e para clarear a
  // cor, e para a gota nao virar silhueta chapada contra o fundo escuro.
  liquido: { cor: "#3a2410", emissiva: "#140b03" },
  bocal: ALTURA_BOCAL,
  // Cena noturna: sem reflexo, e o preenchimento azul de sempre marcando o
  // contorno do galao contra o fundo escuro.
  luz: {
    ambiente: 0.6,
    principal: 2.4,
    preenchimento: { posicao: [-5, 3, 4], intensidade: 22, cor: "#7dd3fc" },
  },
  // `cenario.svg` e arte placeholder e nao tem recipiente desenhado: aqui a
  // jarra procedural e o unico alvo visivel, e o liquido mora dentro dela.
  alvo: ALVO_JARRA,
  deposito: { onde: "cena", fundo: 0.08, raio: 0.77, altura: 1.32 },
  hud: {
    tempo: { x: 50, y: 8, tamanho: 5 },
    nivel: { x: 50, y: 88, largura: 60 },
    rotulo: "JARRA",
    vitoria: "JARRA CHEIA!",
  },
};
