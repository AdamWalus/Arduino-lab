// Światła na przycisk: normalnie czerwone.
// Klik → żółte → zielone (pika co sekundę) → żółte → czerwone.
int czerwona = 10;
int zolta = 11;
int zielona = 12;
int przycisk = 2;
int buzzer = 8;

int czasZielonego = 8;   // ile sekund trwa zielone (tyle razy piknie)

void setup() {
  pinMode(czerwona, OUTPUT);
  pinMode(zolta, OUTPUT);
  pinMode(zielona, OUTPUT);
  pinMode(buzzer, OUTPUT);
  pinMode(przycisk, INPUT_PULLUP);   // wciśnięty = LOW
}

void loop() {
  digitalWrite(czerwona, HIGH);      // stan spoczynku: czerwone

  if (digitalRead(przycisk) == LOW) {
    // czerwone -> żółte
    digitalWrite(czerwona, LOW);
    digitalWrite(zolta, HIGH);
    delay(2000);
    digitalWrite(zolta, LOW);

    // zielone + pikanie co sekundę
    digitalWrite(zielona, HIGH);
    for (int i = 0; i < czasZielonego; i++) {
      tone(buzzer, 1000);   // pik
      delay(200);
      noTone(buzzer);
      delay(800);           // 200 + 800 = 1 sekunda
    }
    digitalWrite(zielona, LOW);

    // żółte -> z powrotem czerwone
    digitalWrite(zolta, HIGH);
    delay(2000);
    digitalWrite(zolta, LOW);
  }
}
