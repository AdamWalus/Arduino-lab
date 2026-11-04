// Wciskasz przycisk — dioda świeci.
// INPUT_PULLUP: normalnie pin czyta HIGH, wciśnięty (zwarty do GND) czyta LOW.
void setup() {
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(2) == LOW) {   // wciśnięty
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}
