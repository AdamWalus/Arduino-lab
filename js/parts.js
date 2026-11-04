// Biblioteka części. Klucz = "type" w project.json.
// pins: id = nazwa pinu użyta w "wires" (np. "led1:A").
// role: vcc | gnd | signal | analog | sda | scl | passive
// vcc: [min, max] napięcia zasilania modułu
// wokwi: { type, pins: {naszPin: 'pinWokwi'}, attrs(part) } albo null, gdy Wokwi nie ma tej części

const P = (id, role, label) => ({ id, role, label: label || id });

export const PARTS = {
  led: {
    name: 'Dioda LED',
    pins: [P('A', 'passive', 'A (+, dłuższa nóżka)'), P('C', 'passive', 'C (−, krótsza nóżka)')],
    desc: 'Świeci, gdy prąd płynie od A do C. Zawsze z rezystorem (220 Ω–1 kΩ).',
    tips: ['Dłuższa nóżka = A (plus).', 'Nie świeci? Najpierw odwróć diodę.', 'Bez rezystora spalisz diodę albo pin.'],
    wokwi: { type: 'wokwi-led', pins: { A: 'A', C: 'C' }, attrs: (p) => ({ color: p.color || 'red' }) },
  },
  resistor: {
    name: 'Rezystor',
    pins: [P('1', 'passive'), P('2', 'passive')],
    desc: 'Ogranicza prąd. Nie ma plusa ani minusa — można wpiąć w dowolną stronę.',
    tips: ['220 Ω: czerwony-czerwony-brązowy', '1 kΩ: brązowy-czarny-czerwony', '10 kΩ: brązowy-czarny-pomarańczowy'],
    wokwi: { type: 'wokwi-resistor', pins: { 1: '1', 2: '2' }, attrs: (p) => ({ value: String(parseOhm(p.value || '220')) }) },
  },
  button: {
    name: 'Przycisk (tact switch)',
    pins: [P('1', 'signal', '1'), P('2', 'signal', '2')],
    desc: 'Wciśnięty łączy 1 z 2. Na płytce stykowej zawsze nad środkowym rowkiem. W kodzie INPUT_PULLUP: wciśnięty = LOW.',
    tips: ['Bierz nóżki po przekątnej — wtedy zawsze działa.', 'Nóżki w tej samej kolumnie płytki = przycisk zwarty na stałe.'],
    wokwi: { type: 'wokwi-pushbutton', pins: { 1: '1.l', 2: '2.l' }, attrs: (p) => ({ color: p.color || 'green' }) },
  },
  buzzer: {
    name: 'Buzzer',
    pins: [P('+', 'signal', '+'), P('-', 'gnd', '−')],
    desc: 'Pika. Pasywny gra tone(pin, Hz), aktywny piszczy sam po podaniu HIGH.',
    tips: ['Nie potrzebuje rezystora.', 'Dłuższa nóżka / znaczek + = plus.'],
    wokwi: { type: 'wokwi-buzzer', pins: { '+': '2', '-': '1' }, attrs: () => ({ volume: '0.1' }) },
  },
  potentiometer: {
    name: 'Potencjometr',
    pins: [P('GND', 'gnd'), P('SIG', 'analog', 'SIG (środek)'), P('VCC', 'vcc')],
    vcc: [3.3, 5],
    desc: 'Gałka. Skrajne nóżki na 5V i GND, środkowa na pin analogowy (0–1023).',
    tips: ['Kręci w złą stronę? Zamień skrajne nóżki.'],
    wokwi: { type: 'wokwi-potentiometer', pins: { GND: 'GND', SIG: 'SIG', VCC: 'VCC' } },
  },
  ldr: {
    name: 'Fotorezystor (goły, 2 nóżki)',
    pins: [P('1', 'passive'), P('2', 'passive')],
    desc: 'Zmienia opór od światła. Sam nic nie da — razem z rezystorem 10 kΩ robi dzielnik napięcia na pin analogowy.',
    tips: ['5V → fotorezystor → A0 + rezystor 10 kΩ → GND.', 'Jasno = duża liczba, ciemno = mała (przy takim podłączeniu).'],
    substitute: 'ldr-module',
    wokwi: null,
  },
  'ldr-module': {
    name: 'Moduł fotorezystora',
    pins: [P('VCC', 'vcc'), P('GND', 'gnd'), P('DO', 'signal', 'DO (cyfrowe)'), P('AO', 'analog', 'AO (analog)')],
    vcc: [3.3, 5],
    desc: 'Fotorezystor z gotowym rezystorem na płytce. AO → pin analogowy, DO = tak/nie (próg pokrętłem).',
    tips: ['Ciemno = duża liczba, jasno = mała.'],
    substitute: 'ldr',
    wokwi: { type: 'wokwi-photoresistor-sensor', pins: { VCC: 'VCC', GND: 'GND', DO: 'DO', AO: 'AO' } },
  },
  'hc-sr04': {
    name: 'Czujnik odległości HC-SR04',
    pins: [P('VCC', 'vcc'), P('TRIG', 'signal'), P('ECHO', 'signal'), P('GND', 'gnd')],
    vcc: [5, 5],
    desc: 'TRIG: Arduino każe „krzyknąć” ultradźwiękiem. ECHO: czas powrotu echa. cm = czas_us / 58.',
    tips: ['Zasilanie 5V.', 'Na ESP32/ESP8266 ECHO daje 5V — dzielnik napięcia albo wersja HC-SR04P.'],
    wokwi: { type: 'wokwi-hc-sr04', pins: { VCC: 'VCC', TRIG: 'TRIG', ECHO: 'ECHO', GND: 'GND' } },
  },
  bmp280: {
    name: 'Czujnik BMP280 (HW-611)',
    pins: [P('VCC', 'vcc'), P('GND', 'gnd'), P('SCL', 'scl'), P('SDA', 'sda'), P('CSB', 'signal'), P('SDO', 'signal')],
    vcc: [1.8, 3.6],
    desc: 'Temperatura i ciśnienie przez I2C. Biblioteka: Adafruit BMP280. Adres 0x76 albo 0x77.',
    tips: ['VCC na 3V3, nie 5V!', 'CSB i SDO zostaw wolne.', '„Nie widzę czujnika” = zamienione SDA/SCL albo luźny kabel.'],
    wokwi: null,
  },
  dht11: {
    name: 'Czujnik DHT11',
    pins: [P('VCC', 'vcc'), P('DATA', 'signal'), P('GND', 'gnd')],
    vcc: [3.3, 5],
    desc: 'Temperatura i wilgotność. Biblioteka: DHT sensor library (Adafruit).',
    tips: ['Odczyt najwyżej co 1–2 s.'],
    wokwi: { type: 'wokwi-dht22', pins: { VCC: 'VCC', DATA: 'SDA', GND: 'GND' } },
  },
  dht22: {
    name: 'Czujnik DHT22',
    pins: [P('VCC', 'vcc'), P('DATA', 'signal'), P('GND', 'gnd')],
    vcc: [3.3, 5],
    desc: 'Temperatura i wilgotność, dokładniejszy niż DHT11.',
    wokwi: { type: 'wokwi-dht22', pins: { VCC: 'VCC', DATA: 'SDA', GND: 'GND' } },
  },
  ds18b20: {
    name: 'Termometr DS18B20',
    pins: [P('GND', 'gnd'), P('DQ', 'signal'), P('VCC', 'vcc')],
    vcc: [3, 5.5],
    desc: 'Termometr 1-Wire. Biblioteki: OneWire + DallasTemperature. Między DQ a VCC rezystor 4,7 kΩ.',
    wokwi: { type: 'wokwi-ds18b20', pins: { GND: 'GND', DQ: 'DQ', VCC: 'VCC' } },
  },
  servo: {
    name: 'Serwo SG90',
    pins: [P('GND', 'gnd', 'GND (brązowy)'), P('V+', 'vcc', 'V+ (czerwony)'), P('PWM', 'signal', 'PWM (pomarańczowy)')],
    vcc: [4.8, 6],
    desc: 'Kręci ramieniem 0–180°. Biblioteka Servo.h, myservo.write(kąt).',
    tips: ['Przy kilku serwach zasilanie zewnętrzne, wspólne GND.'],
    wokwi: { type: 'wokwi-servo', pins: { GND: 'GND', 'V+': 'V+', PWM: 'PWM' } },
  },
  'lcd-i2c': {
    name: 'Wyświetlacz LCD 16x2 I2C',
    pins: [P('GND', 'gnd'), P('VCC', 'vcc'), P('SDA', 'sda'), P('SCL', 'scl')],
    vcc: [5, 5],
    desc: 'Tekst 2×16 znaków przez I2C. Biblioteka LiquidCrystal_I2C, adres zwykle 0x27.',
    tips: ['Nic nie widać? Pokręć potencjometrem kontrastu z tyłu.'],
    wokwi: { type: 'wokwi-lcd1602', pins: { GND: 'GND', VCC: 'VCC', SDA: 'SDA', SCL: 'SCL' }, attrs: () => ({ pins: 'i2c' }) },
  },
  oled: {
    name: 'OLED 0.96" SSD1306 I2C',
    pins: [P('GND', 'gnd'), P('VCC', 'vcc'), P('SCL', 'scl'), P('SDA', 'sda')],
    vcc: [3.3, 5],
    desc: 'Mały ekran 128×64. Biblioteki Adafruit SSD1306 + GFX, adres 0x3C.',
    wokwi: { type: 'board-ssd1306', pins: { GND: 'GND', VCC: 'VCC', SCL: 'SCL', SDA: 'SDA' } },
  },
  'rgb-led': {
    name: 'Dioda RGB (wspólna katoda)',
    pins: [P('R', 'passive'), P('COM', 'passive', 'COM (−, najdłuższa)'), P('G', 'passive'), P('B', 'passive')],
    desc: 'Trzy diody w jednej. Każdy kolor na pin PWM przez swój rezystor, COM do GND.',
    wokwi: { type: 'wokwi-rgb-led', pins: { R: 'R', COM: 'COM', G: 'G', B: 'B' } },
  },
  relay: {
    name: 'Moduł przekaźnika',
    pins: [P('VCC', 'vcc'), P('GND', 'gnd'), P('IN', 'signal'), P('COM', 'passive'), P('NO', 'passive'), P('NC', 'passive')],
    vcc: [5, 5],
    desc: 'Włącza większe obciążenie. Strona COM/NO/NC jest odizolowana od Arduino.',
    tips: ['Nie podłączaj 230V na labach.'],
    wokwi: { type: 'wokwi-relay-module', pins: { VCC: 'VCC', GND: 'GND', IN: 'IN', COM: 'COM', NO: 'NO', NC: 'NC' } },
  },
  pir: {
    name: 'Czujnik ruchu PIR HC-SR501',
    pins: [P('VCC', 'vcc'), P('OUT', 'signal'), P('GND', 'gnd')],
    vcc: [5, 12],
    desc: 'HIGH, gdy wykryje ruch. Pokrętła: czułość i czas.',
    wokwi: { type: 'wokwi-pir-motion-sensor', pins: { VCC: 'VCC', OUT: 'OUT', GND: 'GND' } },
  },
  module: {
    name: 'Moduł (ogólny)',
    pins: [],
    desc: 'Dowolny moduł — piny podane w projekcie.',
    wokwi: null,
  },
};

export function parseOhm(v) {
  const s = String(v).replace(/\s|Ω|ohm/gi, '').replace(',', '.').toLowerCase();
  const m = s.match(/^([\d.]+)([km]?)$/);
  if (!m) return 220;
  return Math.round(parseFloat(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1));
}

// Zgadywanie roli pinu po nazwie (dla modułów ogólnych).
export function guessRole(name) {
  const n = name.toUpperCase();
  if (/^(VCC|VDD|VIN|V\+|\+|5V|3V3|3\.3V)$/.test(n)) return 'vcc';
  if (/^(GND|G|-|−|VSS)$/.test(n)) return 'gnd';
  if (n === 'SDA') return 'sda';
  if (n === 'SCL') return 'scl';
  if (/^(AO|A0UT|AOUT|SIG)$/.test(n)) return 'analog';
  return 'signal';
}

// Zwraca definicję części z uwzględnieniem nadpisań z projektu (part.pins, part.vcc).
export function partDef(part) {
  const base = PARTS[part.type] || PARTS.module;
  let pins = base.pins;
  if (Array.isArray(part.pins) && part.pins.length) {
    pins = part.pins.map((p) => (typeof p === 'string' ? P(p, guessRole(p)) : { label: p.id, role: guessRole(p.id), ...p }));
  }
  return { ...base, pins, vcc: part.vcc || base.vcc, known: !!PARTS[part.type] };
}

export function partTitle(part) {
  const d = partDef(part);
  if (part.label) return part.label;
  if (part.type === 'resistor') return `Rezystor ${part.value || ''}`.trim();
  if (part.type === 'led') return `Dioda ${colorPl(part.color)}`.trim();
  if (part.type === 'module') return part.name || 'Moduł';
  return d.name;
}

export function colorPl(c) {
  return { red: 'czerwona', green: 'zielona', yellow: 'żółta', blue: 'niebieska', white: 'biała', orange: 'pomarańczowa' }[c] || c || '';
}
