/*
 * Garrafa - firmware BLE
 * Placa  : ESP32-C3 Super Mini
 * Sensor : GY-521 (MPU-6050) - SDA=GPIO5, SCL=GPIO6
 *
 * Anuncia como "Garrafa".
 *
 *   Service  7a9c0001-4b1e-4b9a-9c3f-2d5e6f701122
 *   ESTADO   7a9c0002-...  notify, 9 bytes little-endian
 *              [0]   uint8  status      0=parada 1=girando 2=acabou de parar
 *              [1-2] uint16 angulo      centesimos de grau, 0..35999 (yaw)
 *              [3-4] int16  taxa        graus/s no eixo Z
 *              [5]   uint8  seq         +1 a cada parada de giro
 *              [6]   uint8  flags       bit0 = giroscopio saturou
 *                                        bit1 = calibrando, nao mexa
 *              [7-8] uint16 inclinacao  DECIMOS de grau a partir da vertical,
 *                                        0..1800
 *   COMANDO  7a9c0003-...  write, 1 byte
 *              0x01 zerar angulo       0x02 recalibrar giroscopio
 *              0x03 armar rodada       0x04 marcar pose atual como zero grau
 *
 * A inclinacao sai de um filtro complementar: o acelerometro da a referencia
 * absoluta da gravidade mas treme com o movimento; o giroscopio e suave mas
 * deriva. Misturar os dois entrega um angulo estavel e sem atraso.
 */

#include <Wire.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------------------------------------------------------------- hardware
#define SDA_PIN   5
#define SCL_PIN   6
#define MPU_ADDR  0x68

#define REG_PWR_MGMT_1   0x6B
#define REG_SMPLRT_DIV   0x19
#define REG_CONFIG       0x1A
#define REG_GYRO_CONFIG  0x1B
#define REG_ACCEL_CONFIG 0x1C
#define REG_ACCEL_XOUT_H 0x3B

// ---------------------------------------------------------------- BLE UUIDs
#define SVC_UUID   "7a9c0001-4b1e-4b9a-9c3f-2d5e6f701122"
#define CHR_STATE  "7a9c0002-4b1e-4b9a-9c3f-2d5e6f701122"
#define CHR_CMD    "7a9c0003-4b1e-4b9a-9c3f-2d5e6f701122"

// ---------------------------------------------------------------- constantes
/*
 * Fundo de escala do giroscopio: +-500 graus/s, 65.5 LSB por grau/s.
 *
 * O jogo e de inclinar, nao de girar. Virar a garrafa 90 graus em 0.3 s da
 * cerca de 300 graus/s, entao +-500 cobre o movimento real com folga e rende
 * 4x mais resolucao que os +-2000 anteriores. Descer para +-250 daria 8x, mas
 * saturaria justamente no despejo rapido, que e a acao principal.
 */
const float GYRO_SCALE  = 65.5f;
const float ACCEL_SCALE = 16384.0f;   // LSB por g em +-2g
const float RAD_PARA_GRAU = 57.29577951f;

/**
 * Constante de tempo do filtro complementar, em segundos.
 *
 * O peso do giroscopio e derivado dela e do dt medido, e nao fixado no codigo:
 * peso fixo assume periodo de loop fixo. Com o loop em torno de 1 ms, o antigo
 * 0.98 dava tau de apenas 0.05 s, ou seja o filtro seguia quase so o
 * acelerometro e o tremor da mao passava direto.
 */
const float TAU_FILTRO = 0.5f;

const float         LIMIAR_ARMAR  = 300.0f;  // so acima disso conta como giro
const float         LIMIAR_PARADA = 10.0f;
const unsigned long TEMPO_PARADA  = 500;
const int16_t       RAW_SATURACAO = 32000;

/*
 * Ritmo das notificacoes.
 *
 * 20 ms e o mesmo do firmware do aviao, e e o piso util: o Chrome negocia
 * intervalo de conexao entre 15 e 30 ms, entao pedir mais rapido que isso so
 * enfileira pacote que o radio nao tem quando entregar.
 *
 * O modo ocioso existe para a garrafa esquecida em cima da mesa nao gastar
 * bateria falando a 50 Hz. Era 250 ms, e isso custava caro na hora errada: o
 * inicio de um despejo podia demorar um quarto de segundo para chegar na tela.
 * A 100 ms com limiares baixos, qualquer movimento de mao ja cai no ritmo
 * rapido antes de a inclinacao virar jato.
 */
const unsigned long PERIODO_ATIVO = 20;    // ms -> 50 Hz
const unsigned long PERIODO_OCIOSO = 100;  // ms -> 10 Hz
/** Acima dessa inclinacao ou taxa, o jogo precisa de amostras rapidas. */
const float LIMIAR_ATIVIDADE_TILT = 2.0f;
const float LIMIAR_ATIVIDADE_TAXA = 8.0f;

// ---------------------------------------------------------------- estado
float yaw   = 0.0f;
float roll  = 0.0f;   // graus
float pitch = 0.0f;   // graus
float tilt  = 0.0f;   // graus a partir da vertical

float gxBias = 0.0f, gyBias = 0.0f, gzBias = 0.0f;

/**
 * Direcao da gravidade na pose de descanso, como vetor unitario no referencial
 * do sensor. E o "zero" da inclinacao.
 *
 * O sensor fica colado na garrafa num angulo arbitrario, entao nao existe uma
 * orientacao "certa" de fabrica: o que importa e o quanto a garrafa saiu da
 * posicao em que estava parada. Guardar essa direcao e medir o angulo ate ela
 * torna a leitura independente de como o sensor foi montado.
 *
 * O padrao (0,0,1) equivale a "deitado e nivelado", que era o comportamento
 * anterior. Fica gravado na NVS: calibra uma vez, sobrevive a reboot.
 */
float refX = 0.0f, refY = 0.0f, refZ = 1.0f;

Preferences prefs;

unsigned long tPrev   = 0;
unsigned long tParado = 0;
unsigned long tNotify = 0;

bool    girando = false;
bool    saturou = false;
/*
 * Verdadeiro enquanto `calibrar()` mede.
 *
 * A medida trava o `loop` por uns 3 s, entao ninguem consegue avisar do lado de
 * dentro que ela acabou. O truque, copiado do firmware do aviao, e notificar
 * uma vez ANTES de travar: a tela ve o bit subir, mostra "nao mexa", e sabe que
 * terminou quando ele desce no primeiro pacote depois da medida. Assim a UI nao
 * precisa cronometrar a duracao no relogio dela, que era chute.
 */
bool    calibrando = false;
uint8_t seq     = 0;

volatile uint8_t cmdPendente = 0;
bool             clienteConectado = false;

BLECharacteristic *chrEstado = nullptr;
BLEServer         *servidor  = nullptr;

/** Leitura crua dos seis eixos. */
struct Amostra {
  int16_t ax, ay, az;
  int16_t gx, gy, gz;
};


// ---------------------------------------------------------------- MPU
void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

bool lerAmostra(Amostra &out) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_ACCEL_XOUT_H);
  Wire.endTransmission(false);
  if (Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)14) != 14) return false;

  uint8_t b[14];
  for (int i = 0; i < 14; i++) b[i] = Wire.read();

  out.ax = (int16_t)((b[0] << 8) | b[1]);
  out.ay = (int16_t)((b[2] << 8) | b[3]);
  out.az = (int16_t)((b[4] << 8) | b[5]);
  // b[6], b[7] sao temperatura: nao usamos.
  out.gx = (int16_t)((b[8] << 8) | b[9]);
  out.gy = (int16_t)((b[10] << 8) | b[11]);
  out.gz = (int16_t)((b[12] << 8) | b[13]);
  return true;
}

/** Angulos de inclinacao vindos so da gravidade. Referencia absoluta. */
void anglosDoAcelerometro(const Amostra &a, float &rollOut, float &pitchOut) {
  float ax = a.ax / ACCEL_SCALE;
  float ay = a.ay / ACCEL_SCALE;
  float az = a.az / ACCEL_SCALE;

  rollOut  = atan2f(ay, az) * RAD_PARA_GRAU;
  pitchOut = atan2f(-ax, sqrtf(ay * ay + az * az)) * RAD_PARA_GRAU;
}

/**
 * Direcao da gravidade reconstruida a partir dos angulos ja filtrados. Assim a
 * inclinacao herda a suavidade do filtro complementar em vez de vir crua do
 * acelerometro.
 */
void direcaoDaGravidade(float rollGraus, float pitchGraus,
                        float &x, float &y, float &z) {
  float r = rollGraus / RAD_PARA_GRAU;
  float p = pitchGraus / RAD_PARA_GRAU;

  x = -sinf(p);
  y = cosf(p) * sinf(r);
  z = cosf(p) * cosf(r);
}

void carregarReferencia() {
  prefs.begin("garrafa", true);
  refX = prefs.getFloat("refX", 0.0f);
  refY = prefs.getFloat("refY", 0.0f);
  refZ = prefs.getFloat("refZ", 1.0f);
  prefs.end();

  // Referencia corrompida ou nunca gravada volta para "deitado e nivelado".
  float norma = sqrtf(refX * refX + refY * refY + refZ * refZ);
  if (!(norma > 0.5f)) {
    refX = 0.0f; refY = 0.0f; refZ = 1.0f;
  } else {
    refX /= norma; refY /= norma; refZ /= norma;
  }

  if (Serial) {
    Serial.print(">> Zero da inclinacao: ");
    Serial.print(refX, 3); Serial.print(", ");
    Serial.print(refY, 3); Serial.print(", ");
    Serial.println(refZ, 3);
  }
}

/**
 * Marca a pose ATUAL como zero grau.
 *
 * Nao existe orientacao "certa": o sensor pode estar colado na garrafa de
 * qualquer jeito. O unico requisito e ficar parado durante a medida, na
 * posicao que voce quer chamar de descanso.
 */
void calibrarNivel() {
  if (Serial) Serial.println(">> Marcando a posicao atual como zero. NAO MEXA...");

  const int N = 800;
  double sx = 0, sy = 0, sz = 0;
  int lidas = 0;
  Amostra a;

  for (int i = 0; i < N; i++) {
    if (lerAmostra(a)) {
      sx += a.ax;
      sy += a.ay;
      sz += a.az;
      lidas++;
    }
    delay(2);
  }

  if (lidas == 0) {
    if (Serial) Serial.println(">> Falhou: sensor nao respondeu.");
    return;
  }

  float mx = (float)(sx / lidas);
  float my = (float)(sy / lidas);
  float mz = (float)(sz / lidas);
  float norma = sqrtf(mx * mx + my * my + mz * mz);

  // Em queda livre ou sob agitacao forte a gravidade nao aparece e nao ha
  // direcao confiavel para gravar.
  if (norma < ACCEL_SCALE * 0.5f) {
    if (Serial) Serial.println(">> Falhou: sem gravidade estavel. Segure parado.");
    return;
  }

  refX = mx / norma;
  refY = my / norma;
  refZ = mz / norma;

  prefs.begin("garrafa", false);
  prefs.putFloat("refX", refX);
  prefs.putFloat("refY", refY);
  prefs.putFloat("refZ", refZ);
  prefs.end();

  // Reinicia o filtro na pose medida para que a inclinacao leia zero na hora.
  if (lerAmostra(a)) anglosDoAcelerometro(a, roll, pitch);

  if (Serial) {
    Serial.print(">> Zero gravado: ");
    Serial.print(refX, 3); Serial.print(", ");
    Serial.print(refY, 3); Serial.print(", ");
    Serial.println(refZ, 3);
  }
}

void calibrar() {
  calibrando = true;
  notificar(0, 0);                 // avisa a UI antes de travar o loop
  if (Serial) Serial.println(">> Calibrando. NAO MEXA...");

  const int N = 1500;
  double sx = 0, sy = 0, sz = 0;
  Amostra a;

  for (int i = 0; i < N; i++) {
    if (lerAmostra(a)) {
      sx += a.gx;
      sy += a.gy;
      sz += a.gz;
    }
    delay(2);
  }

  gxBias = (float)(sx / N);
  gyBias = (float)(sy / N);
  gzBias = (float)(sz / N);

  // Parte o filtro ja no angulo real, senao ele leva segundos convergindo.
  if (lerAmostra(a)) anglosDoAcelerometro(a, roll, pitch);

  if (Serial) {
    Serial.print(">> Bias Z = ");
    Serial.print(gzBias / GYRO_SCALE, 2);
    Serial.print(" graus/s | inclinacao inicial ");
    Serial.print(tilt, 1);
    Serial.println(" graus. Pronto.");
  }

  yaw        = 0.0f;
  girando    = false;
  saturou    = false;
  calibrando = false;
  tPrev      = micros();
}


// ---------------------------------------------------------------- BLE
class CallbacksServidor : public BLEServerCallbacks {
  void onConnect(BLEServer *s) override {
    clienteConectado = true;
    if (Serial) Serial.println(">> Cliente conectado.");
  }
  void onDisconnect(BLEServer *s) override {
    clienteConectado = false;
    if (Serial) Serial.println(">> Cliente desconectou. Anunciando de novo.");
    BLEDevice::startAdvertising();
  }
};

class CallbacksComando : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    // So registra. O trabalho pesado (I2C) acontece no loop.
    if (c->getLength() >= 1) cmdPendente = c->getData()[0];
  }
};

void notificar(uint8_t status, float taxaZ) {
  uint16_t ang = (uint16_t)(yaw * 100.0f);
  if (ang > 35999) ang = 35999;

  int16_t taxa = (int16_t)constrain(taxaZ, -32000.0f, 32000.0f);

  // Decimos de grau, nao graus inteiros: o jato abre entre 25 e 95 graus, e em
  // passo de 1 grau a vazao inteira tinha so 70 degraus. Cada um aparecia como
  // um solavanco no jorro.
  uint16_t deciTilt = (uint16_t)(constrain(tilt, 0.0f, 180.0f) * 10.0f + 0.5f);

  uint8_t buf[9];
  buf[0] = status;
  buf[1] = (uint8_t)(ang & 0xFF);
  buf[2] = (uint8_t)(ang >> 8);
  buf[3] = (uint8_t)(taxa & 0xFF);
  buf[4] = (uint8_t)((taxa >> 8) & 0xFF);
  buf[5] = seq;
  buf[6] = (saturou ? 0x01 : 0x00) | (calibrando ? 0x02 : 0x00);
  buf[7] = (uint8_t)(deciTilt & 0xFF);
  buf[8] = (uint8_t)(deciTilt >> 8);

  chrEstado->setValue(buf, sizeof(buf));
  if (clienteConectado) chrEstado->notify();
}


// ---------------------------------------------------------------- setup
void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  mpuWrite(REG_PWR_MGMT_1, 0x01);    // acorda, clock do giroscopio X
  delay(100);
  mpuWrite(REG_CONFIG,       0x04);  // DLPF 21 Hz: corta vibracao, custa 8 ms
  mpuWrite(REG_SMPLRT_DIV,   0x00);  // 1 kHz
  mpuWrite(REG_GYRO_CONFIG,  0x08);  // +-500 graus/s, 65.5 LSB por grau/s
  mpuWrite(REG_ACCEL_CONFIG, 0x00);  // +-2g, melhor resolucao para inclinacao
  delay(100);

  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() != 0) {
    if (Serial) Serial.println("ERRO: MPU-6050 nao respondeu em 0x68.");
    while (true) delay(1000);
  }

  BLEDevice::init("Garrafa");
  servidor = BLEDevice::createServer();
  servidor->setCallbacks(new CallbacksServidor());

  BLEService *svc = servidor->createService(SVC_UUID);

  chrEstado = svc->createCharacteristic(
    CHR_STATE, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  chrEstado->addDescriptor(new BLE2902());

  BLECharacteristic *chrCmd = svc->createCharacteristic(
    CHR_CMD, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  chrCmd->setCallbacks(new CallbacksComando());

  svc->start();

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SVC_UUID);
  adv->setScanResponse(true);
  // Intervalo de conexao preferido, em unidades de 1,25 ms: 7,5 a 15 ms. E um
  // pedido, nao uma ordem — quem decide e o celular ou o notebook —, mas sem
  // ele o padrao negociado passa dos 40 ms e engarrafa as notificacoes de 20 ms.
  adv->setMinPreferred(0x06);
  adv->setMaxPreferred(0x0C);
  BLEDevice::startAdvertising();

  if (Serial) Serial.println(">> BLE no ar como \"Garrafa\".");

  // Calibracao depois do anuncio, e nao antes: sao 1500 leituras a 2 ms, uns 3
  // segundos em que a placa ficava muda. Quem ligava a garrafa e clicava em
  // conectar na hora abria um seletor vazio e concluia que ela nao conectava.
  //
  // Nenhum pacote sai com bias sujo por causa da troca: quem notifica e o
  // `loop`, que so comeca quando o `setup` termina. O cliente que conectar
  // durante a medida apenas nao recebe nada nesses 3 segundos — e o mesmo que
  // faz o firmware do aviao.
  carregarReferencia();
  calibrar();

  tPrev = micros();
}


// ---------------------------------------------------------------- loop
void loop() {
  // --- comandos vindos do BLE ---
  if (cmdPendente) {
    uint8_t cmd = cmdPendente;
    cmdPendente = 0;
    switch (cmd) {
      case 0x01: yaw = 0.0f;                        break;
      case 0x02: calibrar();                        break;
      case 0x03: girando = false; saturou = false;  break;
      case 0x04: calibrarNivel();                   break;
    }
  }

  Amostra a;
  if (!lerAmostra(a)) return;

  unsigned long tAgora = micros();
  float dt = (tAgora - tPrev) / 1000000.0f;
  tPrev = tAgora;
  if (dt <= 0 || dt > 0.5f) return;   // descarta salto de tempo

  if (a.gz >= RAW_SATURACAO || a.gz <= -RAW_SATURACAO) saturou = true;

  float gx = (a.gx - gxBias) / GYRO_SCALE;
  float gy = (a.gy - gyBias) / GYRO_SCALE;
  float gz = (a.gz - gzBias) / GYRO_SCALE;

  // --- filtro complementar: inclinacao ---
  float rollAcc, pitchAcc;
  anglosDoAcelerometro(a, rollAcc, pitchAcc);

  // Peso derivado do dt real desta volta, nao fixo: assim a constante de tempo
  // do filtro continua sendo TAU_FILTRO mesmo se o loop mudar de ritmo.
  float alpha = TAU_FILTRO / (TAU_FILTRO + dt);

  roll  = alpha * (roll + gx * dt) + (1.0f - alpha) * rollAcc;
  pitch = alpha * (pitch + gy * dt) + (1.0f - alpha) * pitchAcc;

  // Angulo entre a gravidade agora e a gravidade na pose de descanso. O
  // produto escalar de dois vetores unitarios ja e o cosseno do angulo entre
  // eles, e nao depende da direcao para onde a garrafa foi inclinada.
  float gx_, gy_, gz_;
  direcaoDaGravidade(roll, pitch, gx_, gy_, gz_);
  float cosTilt = gx_ * refX + gy_ * refY + gz_ * refZ;
  tilt = acosf(constrain(cosTilt, -1.0f, 1.0f)) * RAD_PARA_GRAU;

  // --- integracao do giro no plano da mesa ---
  float gzUtil = (fabs(gz) < 1.0f) ? 0.0f : gz;   // zona morta
  yaw += gzUtil * dt;
  while (yaw >= 360.0f) yaw -= 360.0f;
  while (yaw <    0.0f) yaw += 360.0f;

  // --- maquina de estados do giro ---
  bool acabouDeParar = false;

  if (fabs(gzUtil) > LIMIAR_ARMAR) {
    girando = true;
    tParado = tAgora;
  } else if (girando) {
    if (fabs(gzUtil) > LIMIAR_PARADA) {
      tParado = tAgora;
    } else if ((tAgora - tParado) / 1000 > TEMPO_PARADA) {
      girando       = false;
      acabouDeParar = true;
      seq++;
      if (Serial) {
        Serial.print(">>> PAROU EM ");
        Serial.print(yaw, 1);
        Serial.print(" graus  seq=");
        Serial.println(seq);
      }
    }
  }

  // --- notify ---
  bool ativo = girando || tilt > LIMIAR_ATIVIDADE_TILT ||
               fabs(gzUtil) > LIMIAR_ATIVIDADE_TAXA;

  unsigned long agoraMs = millis();
  unsigned long periodo = ativo ? PERIODO_ATIVO : PERIODO_OCIOSO;

  if (acabouDeParar) {
    notificar(2, gzUtil);
    tNotify = agoraMs;
  } else if (agoraMs - tNotify >= periodo) {
    notificar(girando ? 1 : 0, gzUtil);
    tNotify = agoraMs;
  }
}
