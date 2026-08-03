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
