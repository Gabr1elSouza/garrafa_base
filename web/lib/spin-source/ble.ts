import { COMMAND_CODES, decodeState } from "./packet";
import type { SpinCommand, SpinSource, SpinState } from "./types";

export const SERVICE_UUID = "7a9c0001-4b1e-4b9a-9c3f-2d5e6f701122";
export const STATE_UUID = "7a9c0002-4b1e-4b9a-9c3f-2d5e6f701122";
export const COMMAND_UUID = "7a9c0003-4b1e-4b9a-9c3f-2d5e6f701122";

export function isBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/** O usuario fechou o seletor de dispositivos sem escolher nada. */
export class ConnectionCancelled extends Error {
  constructor() {
    super("Seleção de dispositivo cancelada.");
    this.name = "ConnectionCancelled";
  }
}

export class BleSpinSource implements SpinSource {
  readonly kind = "ble" as const;

  private device: BluetoothDevice | null = null;
  private command: BluetoothRemoteGATTCharacteristic | null = null;
  private listeners = new Set<(state: SpinState) => void>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private isConnected = false;

  async connect(): Promise<void> {
    if (!isBluetoothAvailable()) {
      throw new Error(
        "Este navegador não tem Web Bluetooth. Use Chrome ou Edge.",
      );
    }

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
      });
    } catch (error) {
      // O browser lanca NotFoundError tanto quando o usuario cancela quanto
      // quando nada aparece na lista. Os dois casos voltam para "desconectado".
      if (error instanceof DOMException && error.name === "NotFoundError") {
        throw new ConnectionCancelled();
      }
      throw error;
    }

    const server = await device.gatt?.connect();
    if (!server) throw new Error("Não foi possível abrir o GATT.");

    const service = await server.getPrimaryService(SERVICE_UUID);
    const state = await service.getCharacteristic(STATE_UUID);
    this.command = await service.getCharacteristic(COMMAND_UUID);

    state.addEventListener("characteristicvaluechanged", this.onValue);
    await state.startNotifications();

    device.addEventListener("gattserverdisconnected", this.onDisconnected);
    this.device = device;
    this.setConnected(true);
  }

  async disconnect(): Promise<void> {
    this.device?.gatt?.disconnect();
    this.teardown();
  }

  async send(cmd: SpinCommand): Promise<void> {
    if (!this.command) throw new Error("Garrafa não conectada.");
    await this.command.writeValue(new Uint8Array([COMMAND_CODES[cmd]]));
  }

  subscribe(fn: (state: SpinState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  subscribeConnection(fn: (connected: boolean) => void): () => void {
    this.connectionListeners.add(fn);
    // `connect()` termina antes de a UI conseguir se inscrever, entao o estado
    // atual e entregue na inscricao. Sem isso o primeiro evento se perde e a
    // tela nunca sai de "desconectado".
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

  private onValue = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;

    let state: SpinState;
    try {
      state = decodeState(target.value);
    } catch {
      return; // pacote malformado: ignora esta amostra
    }
    this.listeners.forEach((fn) => fn(state));
  };

  private onDisconnected = () => {
    this.teardown();
  };

  private teardown() {
    this.setConnected(false);
    this.device?.removeEventListener(
      "gattserverdisconnected",
      this.onDisconnected,
    );
    this.device = null;
    this.command = null;
  }
}
