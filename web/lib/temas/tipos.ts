import type { Alvo } from "../game/pour";

/** Como o recipiente que despeja e desenhado. */
export type Recipiente =
  | {
      tipo: "modelo";
      /** Caminho do `.glb` em `public`. */
      arquivo: string;
      /** Altura da lata em unidades de cena. */
      altura: number;
    }
  | { tipo: "galao" };

/**
 * Onde esta o recipiente que recebe o liquido, e por consequencia como o
 * liquido e desenhado.
 */
export type Deposito =
  /** A cena desenha a jarra procedural, e o liquido e um cilindro 3D dentro. */
  | {
      onde: "cena";
      /** Altura em que o liquido comeca, acima da base da jarra. */
      fundo: number;
      /** Raio do liquido. Menor que o corpo, senao vaza pela parede. */
      raio: number;
      /** Altura do liquido com a jarra cheia. */
      altura: number;
    }
  /**
   * O recipiente ja vem pintado na arte, com o interior transparente. O liquido
   * e uma camada atras da arte: assim ele aparece pela janela do copo e fica
   * naturalmente atras do gelo e das paredes, que a arte desenha por cima.
   */
  | {
      onde: "arte";
      /**
       * Faixa vertical do liquido, em percentual do palco: `base` e o fundo do
       * copo, `topo` a superficie com ele cheio.
       *
       * Nao ha largura porque nao e preciso: fora da janela a arte e opaca, e e
       * ela mesma quem recorta a camada.
       */
      base: number;
      topo: number;
    };

/** Como a cena 3D e iluminada. */
export type Luz = {
  /** Intensidade da luz ambiente difusa. */
  ambiente: number;
  /** Intensidade da luz principal, que vem de cima e da direita. */
  principal: number;
  /** Preenchimento, para abrir o lado escuro do recipiente. */
  preenchimento: {
    posicao: [number, number, number];
    intensidade: number;
    cor: string;
  };
  /**
   * Quanto do ambiente refletido entra no metal. Ausente nao instala ambiente.
   *
   * O corpo da lata e metal (metalness 1, roughness 0.1). Metal nao tem cor
   * propria sob luz difusa: mostra o que esta em volta. Sem ambiente ele mostra
   * o vazio, e nenhuma quantidade de luz direta resolve — em metal, direcional
   * so vira um ponto de brilho.
   *
   * E o unico botao para o brilho da lata. Ainda escura, sobe; rotulo lavando
   * ou vermelho perdendo saturacao, desce.
   */
  reflexo?: number;
};

/** Posicao e tamanho de um numero do HUD, em percentual do palco. */
export type PecaHud = { x: number; y: number; tamanho: number };

export type Tema = {
  nome: string;
  recipiente: Recipiente;
  /** Imagem de fundo do palco do totem, proporcao 9:16. */
  fundo: string;
  /**
   * Camada opaca atras da arte, em CSS.
   *
   * So aparece onde a arte for transparente. Sem ela o interior do copo mostra
   * o preto do palco e o copo vazio vira um buraco escuro.
   */
  backdrop?: string;
  liquido: { cor: string; emissiva: string };
  /**
   * Altura do bico de onde as gotas saem.
   *
   * Anda junto com `recipiente.altura`: o recipiente de cima pendura a partir
   * daqui, entao uma lata mais alta precisa de um bico mais alto, senao a base
   * dela afunda dentro do recipiente de baixo.
   */
  bocal: number;
  luz: Luz;
  /** Onde as gotas caem. Cada arte poe o recipiente num lugar. */
  alvo: Alvo;
  deposito: Deposito;
  hud: {
    /** Ausente quando o fundo do tema nao tem caixa de pontos. */
    pontos?: PecaHud;
    tempo: PecaHud;
    nivel: { x: number; y: number; largura: number };
    /** Nome do recipiente na barra de nivel. */
    rotulo: string;
    /**
     * Frase da tela de vitoria.
     *
     * Escrita inteira no tema, e nao montada a partir de `rotulo`: "jarra" e
     * feminino e "copo" e masculino, e concordancia nao sai de concatenacao.
     */
    vitoria: string;
  };
};
