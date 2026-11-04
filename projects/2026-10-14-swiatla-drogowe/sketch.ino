// Światła dla pieszych: normalnie zielone. Przycisk → żółte → czerwone z pikaniem → żółte → zielone.
int czerwona = 10;
int zolta = 11;
int zielona = 12;
int przycisk = 2;
int buzzer = 8;

void setup() {
  pinMode(czerwona, OUTPUT);
  pinMode(zolta, OUTPUT);
  pinMode(zielona, OUTPUT);
  pinMode(buzzer, OUTPUT);
  pinMode(przycisk, INPUT_PULLUP);
}

void loop() {
  digitalWrite(zielona, HIGH);

  if (digitalRead(przycisk) == LOW) {
    digitalWrite(zielona, LOW);

    digitalWrite(zolta, HIGH);
    delay(2000);
    digitalWrite(zolta, LOW);

    digitalWrite(czerwona, HIGH);
    for (int i = 0; i < 10; i++) {   // 10 × 0,5 s = 5 s pikania
      tone(buzzer, 1000);
      delay(150);
      noTone(buzzer);
      delay(350);
    }
    digitalWrite(czerwona, LOW);

    digitalWrite(zolta, HIGH);
    delay(2000);
    digitalWrite(zolta, LOW);
  }
}
