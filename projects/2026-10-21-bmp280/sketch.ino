#include <Wire.h>
#include <Adafruit_BMP280.h>

Adafruit_BMP280 bmp;

void setup() {
  Serial.begin(9600);

  if (!bmp.begin(0x76)) {
    if (!bmp.begin(0x77)) {
      Serial.println("Nie widze czujnika, sprawdz kable!");
      while (1);
    }
  }
}

void loop() {
  Serial.print("Temperatura: ");
  Serial.print(bmp.readTemperature());
  Serial.println(" C");

  Serial.print("Cisnienie: ");
  Serial.print(bmp.readPressure() / 100.0);
  Serial.println(" hPa");

  Serial.println("---");
  delay(2000);
}
