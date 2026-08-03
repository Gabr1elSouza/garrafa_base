# Jogo da Garrafa — ESP32-C3 + Next.js

Data: 2026-07-28

## Objetivo

Garrafa física com sensor de rotação. Ao parar, uma tela mostra para qual
jogador ela aponta. Escopo é placar visual apenas — sem desafios, sem
pontuação, sem histórico.

## Hardware

| Peça | Detalhe |
|---|---|
| Placa | ESP32-C3 Super Mini |
| Sensor | GY-521 (MPU-6050) |
| Alimentação | 3× AA em série → pino `5V` |
| Ligação I2C | SDA = GPIO5, SCL = GPIO6, VCC = 3V3, GND = GND |

Endereço I2C do sensor: `0x68`.

## Medição do ângulo

O acelerômetro não mede rotação em torno do eixo da gravidade. O ângulo do
jogo vem exclusivamente da integração do giroscópio no eixo Z.

- Fundo de escala ±2000 °/s (`GYRO_CONFIG = 0x18`, 16.4 LSB por °/s)
- Bias medido na inicialização com 2000 amostras, sensor parado
- Zona morta de 1 °/s elimina ruído residual
- Ângulo é relativo ao ponto de partida, não absoluto — sem magnetômetro não
  existe norte real, e o jogo não precisa de um

Medições de bancada em 2026-07-28: drift zero com o sensor parado; 2 amostras
de 2464 atingiram o teto de ±2000 °/s durante giro forte.

## Transporte

BLE (Web Bluetooth). Escolhido sobre WiFi e USB porque:

- não depende de roteador nem de credenciais no firmware
- consumo baixo (~25 mA médio, ~80 h com 3× AA)
- o browser conecta direto na garrafa; o Next fica frontend puro
- cabo USB enrolaria no giro

Limitação aceita: só Chrome e Edge. Safari e Firefox não implementam Web
Bluetooth.

### Execução local

O app roda em `http://localhost:3000`. `localhost` é contexto seguro por regra
do browser, então Web Bluetooth funciona sem HTTPS.

`http://192.168.x.x:3000` **não** é contexto seguro — abrir de outro aparelho
pela rede bloqueia o BLE. Notebook exibindo direto, ou espelhado em TV por
HDMI, funciona.

## Contrato BLE

Nome anunciado: `Garrafa`

Service: `7a9c0001-4b1e-4b9a-9c3f-2d5e6f701122`

### Characteristic ESTADO — `7a9c0002-4b1e-4b9a-9c3f-2d5e6f701122` (notify)

8 bytes, little-endian. 20 Hz girando, 2 Hz parado.

| Offset | Tipo | Campo | Faixa |
|---|---|---|---|
| 0 | uint8 | `status` | 0 = parada, 1 = girando, 2 = acabou de parar |
| 1–2 | uint16 | `angulo` | centésimos de grau, 0–35999 |
| 3–4 | int16 | `velocidade` | °/s, −2000..2000 |
| 5 | uint8 | `seq` | incrementa a cada resultado novo |
| 6 | uint8 | `flags` | bit0 = giroscópio saturou |
| 7 | uint8 | reservado | bateria, futuro |

`seq` é a fonte da verdade para revelar um resultado. A UI só revela quando o
valor muda, o que impede revelação dupla por notify repetido.

`flags.bit0` sinaliza que a leitura bateu no teto de escala durante o giro. A
UI avisa que o ângulo pode estar impreciso em vez de apresentá-lo como exato.

### Characteristic COMANDO — `7a9c0003-4b1e-4b9a-9c3f-2d5e6f701122` (write)

1 byte:

| Valor | Ação |
|---|---|
| `0x01` | zerar ângulo |
| `0x02` | recalibrar bias do giroscópio |
| `0x03` | armar nova rodada |

## Firmware

Baseado em `teste_360/teste_360.ino`, com três mudanças:

1. Camada BLE publicando o contrato acima, mantendo a saída Serial para debug
2. Correção do disparo falso: armar o estado "girando" só acima de 300 °/s,
   para que esbarrões não contem como rodada
3. Marcar `flags.bit0` quando a leitura bruta atingir o fundo de escala

Risco de espaço: o sketch atual ocupa 307 KB e a stack BLE adiciona cerca de
600–700 KB. A partição `default` oferece 1.2 MB para a aplicação. Se estourar,
trocar para `huge_app`.

## Frontend

Next.js, App Router, TypeScript, Tailwind. Sem backend.

```
web/
  app/page.tsx
  lib/spin-source/types.ts    interface SpinSource, tipo SpinState
  lib/spin-source/ble.ts      BleSpinSource — garrafa real
  lib/spin-source/mock.ts     MockSpinSource — giro simulado
  lib/game/wheel.ts           ângulo → jogador, função pura
  lib/game/players.ts         nomes e cores
  components/ConnectButton.tsx
  components/Wheel.tsx
  components/ResultOverlay.tsx
  components/StatusBar.tsx
```

### Abstração de fonte

```ts
type SpinState = {
  status: 'idle' | 'spinning' | 'stopped'
  angle: number
  rate: number
  seq: number
  saturated: boolean
}

interface SpinSource {
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(cmd: 'zero' | 'calibrate' | 'arm'): Promise<void>
  subscribe(fn: (s: SpinState) => void): () => void
}
```

O jogo conhece apenas essa interface. `MockSpinSource` simula giro com
desaceleração por atrito, permitindo desenvolver e demonstrar sem hardware.
Ativado por toggle na UI ou `?mock=1`.

### Máquina de estados

```
desconectado --[clique Conectar]--> pronto
pronto       --[rate > 300 °/s]--> girando
girando      --[seq mudou]-------> revelando
revelando    --[3 s ou clique]---> pronto
qualquer     --[BLE caiu]--------> desconectado
```

### Mapeamento ângulo → jogador

360° dividido em N fatias iguais, jogador 1 começando em 0°.

```ts
function playerAt(angle: number, n: number): number {
  const slice = 360 / n
  return Math.floor((((angle % 360) + 360) % 360) / slice)
}
```

Número de jogadores (2–12) e nomes ficam em `localStorage`.

### Renderização

SVG. Fatias são `<path>` com arco; o ponteiro é um `<g>` com
`transform: rotate(angle)`. Amostras chegam a 20 Hz e uma transição CSS de
50 ms suaviza o intervalo entre elas. Sem biblioteca de animação.

## Tratamento de erro

| Situação | Resposta |
|---|---|
| Browser sem Web Bluetooth | Mensagem explícita e oferta do modo mock |
| Usuário cancela o seletor de dispositivo | Volta a `desconectado`, sem erro |
| Conexão cai no meio do jogo | Faixa de aviso e tentativa de reconexão |
| `flags.bit0` marcado | Resultado exibido com aviso de imprecisão |
| Giro não para em 15 s | Timeout, volta a `pronto` |

## Testes

- `playerAt` — teste unitário cobrindo limites de fatia, ângulo 0, ângulo 360,
  valores negativos e N mínimo e máximo
- Decodificação do pacote BLE — teste unitário sobre bytes conhecidos,
  incluindo `velocidade` negativa e `angulo` no máximo
- `MockSpinSource` — verificação de que o giro sempre converge para parada e
  incrementa `seq` uma única vez por rodada

## Fora de escopo

Desafios, pontuação, histórico de rodadas, múltiplos aparelhos sincronizados,
deploy remoto, monitoramento de bateria.
