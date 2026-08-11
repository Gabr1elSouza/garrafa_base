export type SpinStatus = "idle" | "spinning" | "stopped";

export type SpinState = {
  /** `stopped` aparece uma unica vez, no instante em que a garrafa para. */
  status: SpinStatus;
  /** Graus, 0..360. */
  angle: number;
  /** Graus por segundo. Negativo = sentido oposto. */
  rate: number;
  /** Incrementa a cada resultado. A UI so revela quando esse numero muda. */
  seq: number;
  /** O giroscopio bateu no fundo de escala: o angulo pode estar impreciso. */
  saturated: boolean;
  /**
   * O firmware esta medindo o bias e nao vai notificar por alguns segundos.
   * Sobe no ultimo pacote antes da medida e desce no primeiro depois dela.
   */
  calibrating: boolean;
  /**
   * Inclinacao a partir da vertical, 0..180 graus. Sai do filtro complementar
   * no firmware. E o que abre o jato no jogo de derramar.
   */
  tilt: number;
};

/** `level` grava o desvio do acelerometro e exige o sensor deitado e nivelado. */
export type SpinCommand = "zero" | "calibrate" | "arm" | "level";

export interface SpinSource {
  readonly kind: "ble" | "mock";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(cmd: SpinCommand): Promise<void>;
  /** Retorna a funcao que cancela a inscricao. */
  subscribe(fn: (state: SpinState) => void): () => void;
  /** Avisa quando o transporte cai por conta propria (garrafa sumiu, pilha acabou). */
  subscribeConnection(fn: (connected: boolean) => void): () => void;
}

export const INITIAL_STATE: SpinState = {
  status: "idle",
  angle: 0,
  rate: 0,
  seq: 0,
  saturated: false,
  calibrating: false,
  tilt: 0,
};
