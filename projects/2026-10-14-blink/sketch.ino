// Mruganie diodą na pinie D13
void setup() {
  pinMode(13, OUTPUT);      // D13 jako wyjście
}

void loop() {
  digitalWrite(13, HIGH);   // włącz (5V na pinie)
  delay(500);
  digitalWrite(13, LOW);    // wyłącz
  delay(500);
}
