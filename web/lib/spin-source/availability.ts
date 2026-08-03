import { isBluetoothAvailable } from "./ble";

/**
 * Presenca do Web Bluetooth lida como store externa. A disponibilidade nunca
 * muda durante a sessao, entao `subscribe` nao precisa notificar nada; o valor
 * do servidor e otimista para que a primeira pintura nao mostre um aviso que
 * vai sumir logo em seguida.
 */
export const bluetoothAvailability = {
  subscribe(): () => void {
    return () => {};
  },
  getSnapshot(): boolean {
    return isBluetoothAvailable();
  },
  getServerSnapshot(): boolean {
    return true;
  },
};
