import type { SpinState, SpinStatus } from "./types";

/** Tamanho do pacote de estado emitido pelo firmware. */
export const PACKET_SIZE = 8;

const STATUS_BY_CODE: Record<number, SpinStatus> = {
  0: "idle",
  1: "spinning",
  2: "stopped",
};

/**
 * Decodifica os 8 bytes little-endian da characteristic ESTADO.
 *
 *   [0]   uint8  status
 *   [1-2] uint16 angulo em centesimos de grau
 *   [3-4] int16  taxa em graus/s
 *   [5]   uint8  seq
 *   [6]   uint8  flags, bit0 = saturou
 *   [7]   uint8  inclinacao em graus a partir da vertical, 0..180
 */
export function decodeState(view: DataView): SpinState {
  if (view.byteLength < PACKET_SIZE) {
    throw new Error(
      `Pacote BLE com ${view.byteLength} bytes, esperado ${PACKET_SIZE}.`,
    );
  }

  return {
    status: STATUS_BY_CODE[view.getUint8(0)] ?? "idle",
    angle: view.getUint16(1, true) / 100,
    rate: view.getInt16(3, true),
    seq: view.getUint8(5),
    saturated: (view.getUint8(6) & 0x01) !== 0,
    tilt: view.getUint8(7),
  };
}

export const COMMAND_CODES = {
  zero: 0x01,
  calibrate: 0x02,
  arm: 0x03,
  level: 0x04,
} as const;
