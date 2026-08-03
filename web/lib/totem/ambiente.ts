/**
 * Se o browser considera esta pagina um contexto seguro, lido como store
 * externa — mesmo padrao de `bluetoothAvailability`.
 *
 * `isBluetoothAvailable()` so testa se `navigator.bluetooth` existe, e ele
 * existe tambem quando a pagina esta aberta pelo IP da rede. Sem esta checagem
 * o aviso certo nunca aparece e `requestDevice()` estoura com um erro cru que
 * nao diz o que fazer.
 *
 * A resposta nao muda durante a sessao, entao `subscribe` nao notifica nada; o
 * valor do servidor e otimista para que a primeira pintura nao mostre um aviso
 * que vai sumir logo em seguida.
 */
export const contextoSeguro = {
  subscribe(): () => void {
    return () => {};
  },
  getSnapshot(): boolean {
    return window.isSecureContext;
  },
  getServerSnapshot(): boolean {
    return true;
  },
};
