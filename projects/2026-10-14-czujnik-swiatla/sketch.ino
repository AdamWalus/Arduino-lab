// Lampka nocna: dioda zapala się, gdy jest ciemno.
// Goły fotorezystor + rezystor 10k = dzielnik napięcia na A0.
// Przy tym podłączeniu: jasno = duża liczba, ciemno = mała.
int dioda = 13;
int czujnik = A0;
int prog = 425;   // granica jasno/ciemno — ustaw po odczytach z Monitora portu

void setup() {
  pinMode(dioda, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int swiatlo = analogRead(czujnik);   // 0–1023
  Serial.println(swiatlo);

  if (swiatlo < prog) {                // ciemno
    digitalWrite(dioda, HIGH);
  } else {                             // jasno
    digitalWrite(dioda, LOW);
  }
  delay(200);
}
