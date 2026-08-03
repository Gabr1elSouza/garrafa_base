/*
 * Teste de angulo 360 graus - Jogo da Garrafa
 * Placa   : ESP32-C3 Super Mini
 * Sensor  : GY-521 (MPU-6050) via I2C
 *
 * Ligacao:
 *   GY-521 VCC -> 3V3
 *   GY-521 GND -> GND
 *   GY-521 SDA -> GPIO5
 *   GY-521 SCL -> GPIO6
 *
 * Comandos no Serial Monitor:
 *   z <enter> -> zera o angulo
 *   c <enter> -> recalibra o giroscopio (deixe parado)
 */

#include <Wire.h>

#define SDA_PIN   5
#define SCL_PIN   6
#define MPU_ADDR  0x68

// Registradores
#define REG_PWR_MGMT_1   0x6B
#define REG_SMPLRT_DIV   0x19
#define REG_CONFIG       0x1A
#define REG_GYRO_CONFIG  0x1B
#define REG_GYRO_ZOUT_H  0x47

// Fundo de escala +-2000 graus/s -> 16.4 LSB por grau/s
const float GYRO_SCALE = 16.4f;

// Deteccao de parada
const float         LIMIAR_PARADA = 10.0f;   // graus/s
const unsigned long TEMPO_PARADA  = 500;     // ms parado para confirmar

float         yaw      = 0.0f;   // angulo acumulado, 0..360
float         gzBias   = 0.0f;   // offset do giroscopio em LSB
unsigned long tPrev    = 0;
unsigned long tParado  = 0;
unsigned long tPrint   = 0;
bool          girando  = false;
int           linhas   = 0;


void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

int16_t lerGyroZ() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_GYRO_ZOUT_H);
  Wire.endTransmission(false);
  if (Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)2) != 2) return 0;
  int16_t hi = Wire.read();
  int16_t lo = Wire.read();
  return (int16_t)((hi << 8) | lo);
}

void calibrar() {
  Serial.println();
  Serial.println(">> Calibrando. NAO MEXA no sensor...");

  const int N = 2000;
  double soma = 0;
  for (int i = 0; i < N; i++) {
    soma += lerGyroZ();
    delay(2);
    if (i % 400 == 0) Serial.print('.');
  }
  gzBias = (float)(soma / N);

  Serial.println();
  Serial.print(">> Bias = ");
  Serial.print(gzBias, 1);
  Serial.print(" LSB (");
  Serial.print(gzBias / GYRO_SCALE, 2);
  Serial.println(" graus/s)");
  Serial.println(">> Pronto. Gire a garrafa.");
  Serial.println();

  yaw   = 0.0f;
  tPrev = micros();
}

void legenda() {
  Serial.println("     0        90       180       270      360");
  Serial.println("     +---------+---------+---------+------+");
}

// Barra de 36 posicoes = 10 graus cada
void desenharBarra(float ang) {
  const int N = 36;
  int pos = (int)(ang / 10.0f);
  if (pos < 0)  pos = 0;
  if (pos >= N) pos = N - 1;

  char linha[N + 3];
  linha[0] = '[';
  for (int i = 0; i < N; i++) {
    if      (i == pos)    linha[1 + i] = '#';
    else if (i % 9 == 0)  linha[1 + i] = '+';   // marcas 0/90/180/270
    else                  linha[1 + i] = '.';
  }
  linha[N + 1] = ']';
  linha[N + 2] = '\0';
  Serial.print(linha);
}

const char* setor(float ang) {
  if (ang <  22.5f) return "N ";
  if (ang <  67.5f) return "NE";
  if (ang < 112.5f) return "L ";
  if (ang < 157.5f) return "SE";
  if (ang < 202.5f) return "S ";
  if (ang < 247.5f) return "SO";
  if (ang < 292.5f) return "O ";
  if (ang < 337.5f) return "NO";
  return "N ";
}


void setup() {
  Serial.begin(115200);
  delay(1500);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  // Acorda o sensor e usa o giroscopio X como fonte de clock (mais estavel)
  mpuWrite(REG_PWR_MGMT_1, 0x01);
  delay(100);
  mpuWrite(REG_CONFIG,      0x01);   // DLPF 188 Hz
  mpuWrite(REG_SMPLRT_DIV,  0x00);   // 1 kHz
  mpuWrite(REG_GYRO_CONFIG, 0x18);   // +-2000 graus/s
  delay(100);

  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println("ERRO: MPU-6050 nao respondeu em 0x68.");
    Serial.println("Confira VCC/GND/SDA(GPIO5)/SCL(GPIO6).");
    while (true) delay(1000);
  }

  Serial.println("=== Teste 360 graus - Jogo da Garrafa ===");
  calibrar();
  legenda();
}


void loop() {
  // --- comandos ---
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'z' || c == 'Z') {
      yaw = 0.0f;
      Serial.println(">> Angulo zerado.");
    } else if (c == 'c' || c == 'C') {
      calibrar();
      legenda();
    }
  }

  // --- integracao ---
  unsigned long tAgora = micros();
  float dt = (tAgora - tPrev) / 1000000.0f;
  tPrev = tAgora;
  if (dt <= 0 || dt > 0.5f) return;   // descarta salto de tempo

  float gz = (lerGyroZ() - gzBias) / GYRO_SCALE;   // graus/s

  // zona morta: mata ruido residual quando parado
  if (fabs(gz) < 1.0f) gz = 0.0f;

  yaw += gz * dt;
  while (yaw >= 360.0f) yaw -= 360.0f;
  while (yaw <    0.0f) yaw += 360.0f;

  // --- deteccao de parada ---
  if (fabs(gz) > LIMIAR_PARADA) {
    girando = true;
    tParado = tAgora;
  } else if (girando && (tAgora - tParado) / 1000 > TEMPO_PARADA) {
    girando = false;
    Serial.println();
    Serial.print(">>> PAROU EM ");
    Serial.print(yaw, 1);
    Serial.print(" graus  (");
    Serial.print(setor(yaw));
    Serial.println(")");
    Serial.println();
    legenda();
    linhas = 0;
  }

  // --- saida visual a 20 Hz ---
  if (millis() - tPrint >= 50) {
    tPrint = millis();

    desenharBarra(yaw);
    Serial.print("  ");
    if (yaw < 100) Serial.print(' ');
    if (yaw < 10)  Serial.print(' ');
    Serial.print(yaw, 1);
    Serial.print("deg ");
    Serial.print(setor(yaw));
    Serial.print("  ");
    Serial.print(gz, 0);
    Serial.println("deg/s");

    if (++linhas >= 20) { legenda(); linhas = 0; }
  }
}
