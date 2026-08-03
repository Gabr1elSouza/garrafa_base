import type { SpinCommand, SpinSource, SpinState } from "./types";

const TICK_MS = 50;
const ATRITO = 420; // graus/s^2
const VELOCIDADE_MIN = 700;
const VELOCIDADE_MAX = 1900;
const LIMIAR_PARADA = 10;

/** Inclinacao maxima simulada e a velocidade com que a "mao" chega la. */
const TILT_DESPEJANDO = 95;
const VELOCIDADE_TILT = 260; // graus/s

/**
 * Garrafa simulada. Mesma interface do BLE, sem hardware.
 * Serve para desenvolver o jogo e para demonstrar se o BLE falhar.
 */
export class MockSpinSource implements SpinSource {
  readonly kind = "mock" as const;

  private listeners = new Set<(state: SpinState) => void>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private angle = 0;
  private rate = 0;
  private seq = 0;
  private spinning = false;
  private isConnected = false;
  private tilt = 0;
  private despejando = false;
  private tiltTimer: ReturnType<typeof setInterval> | null = null;

  async connect(): Promise<void> {
    this.setConnected(true);
    this.emit("idle");
  }

  async disconnect(): Promise<void> {
    this.stopTimer();
    this.pararTiltTimer();
    this.spinning = false;
    this.rate = 0;
    this.tilt = 0;
    this.despejando = false;
    this.setConnected(false);
  }

  async send(cmd: SpinCommand): Promise<void> {
    if (cmd === "zero") {
      this.angle = 0;
      this.emit("idle");
    }
    // "calibrate" e "arm" nao tem efeito observavel no mock.
  }

  subscribe(fn: (state: SpinState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  subscribeConnection(fn: (connected: boolean) => void): () => void {
    this.connectionListeners.add(fn);
    // Entrega o estado atual: `connect()` acontece antes de a UI se inscrever.
    fn(this.isConnected);
    return () => {
      this.connectionListeners.delete(fn);
    };
  }

  private setConnected(value: boolean) {
    if (this.isConnected === value) return;
    this.isConnected = value;
    this.connectionListeners.forEach((fn) => fn(value));
  }

  /**
   * Liga e desliga o despejo. Exclusivo do mock.
   *
   * A inclinacao sobe e desce gradualmente em vez de saltar, para reproduzir o
   * atraso de uma mao real virando a garrafa. Sem isso o jato ligaria e
   * desligaria instantaneamente e o jogo ficaria mais facil no simulador do que
   * com o sensor.
   */
  setPouring(ativo: boolean): void {
    this.despejando = ativo;
    if (this.tiltTimer) return;
    this.tiltTimer = setInterval(() => this.tickTilt(), TICK_MS);
  }

  /** Dispara um giro. Exclusivo do mock — nao faz parte da interface. */
  spin(): void {
    if (this.spinning) return;

    const sentido = Math.random() < 0.5 ? -1 : 1;
    this.rate =
      sentido *
      (VELOCIDADE_MIN + Math.random() * (VELOCIDADE_MAX - VELOCIDADE_MIN));
    this.spinning = true;

    this.stopTimer();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.emit("spinning");
  }

  private tick() {
    const dt = TICK_MS / 1000;
    const sentido = Math.sign(this.rate);

    this.angle = (this.angle + this.rate * dt + 360) % 360;
    this.rate -= sentido * ATRITO * dt;

    // O atrito nao pode empurrar a garrafa para o outro lado.
    if (Math.sign(this.rate) !== sentido) this.rate = 0;

    if (Math.abs(this.rate) <= LIMIAR_PARADA) {
      this.rate = 0;
      this.spinning = false;
      this.seq += 1;
      this.stopTimer();
      this.emit("stopped");
      this.emit("idle");
      return;
    }

    this.emit("spinning");
  }

  private tickTilt() {
    const dt = TICK_MS / 1000;
    const destino = this.despejando ? TILT_DESPEJANDO : 0;
    const passo = VELOCIDADE_TILT * dt;

    if (Math.abs(destino - this.tilt) <= passo) {
      this.tilt = destino;
    } else {
      this.tilt += Math.sign(destino - this.tilt) * passo;
    }

    this.emit(this.spinning ? "spinning" : "idle");

    // Nada mais a animar: para o timer para nao emitir a toa.
    if (!this.despejando && this.tilt === 0) this.pararTiltTimer();
  }

  private pararTiltTimer() {
    if (this.tiltTimer) clearInterval(this.tiltTimer);
    this.tiltTimer = null;
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private emit(status: SpinState["status"]) {
    const state: SpinState = {
      status,
      angle: this.angle,
      rate: Math.round(this.rate),
      seq: this.seq,
      saturated: false,
      tilt: Math.round(this.tilt),
    };
    this.listeners.forEach((fn) => fn(state));
  }
}
