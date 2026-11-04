// Czujnik parkowania: im bliżej przeszkoda, tym szybciej pika.
int buzzer = 3;
int trig = 6;
int echo = 5;

void setup() {
  pinMode(buzzer, OUTPUT);
  pinMode(trig, OUTPUT);
  pinMode(echo, INPUT);
  Serial.begin(9600);
}

long zmierz() {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);         // krótki "krzyk"
  delayMicroseconds(10);
  digitalWrite(trig, LOW);

  long czas = pulseIn(echo, HIGH, 30000);  // ile trwało echo (µs)
  if (czas == 0) return 999;               // nic nie wróciło
  return czas / 58;                        // na centymetry
}

void loop() {
  long cm = zmierz();
  Serial.println(cm);

  if (cm > 50) {             // daleko: cisza
    noTone(buzzer);
    delay(100);
  } else if (cm > 5) {       // im bliżej, tym krótsza przerwa
    tone(buzzer, 1000);
    delay(100);
    noTone(buzzer);
    delay(cm * 10);
  } else {                   // bardzo blisko: ciągły pisk
    tone(buzzer, 1000);
    delay(100);
  }
}
