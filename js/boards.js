// Definicje płytek. Nazwy pinów = napisy na płytce (silkscreen).
// rows: dwa rzędy pinów, kolejność od strony złącza USB.
// rowNames: jak nazywać rząd w instrukcjach (żeby dało się go znaleźć na żywej płytce).

export const BOARDS = {
  nano: {
    name: 'Arduino Nano',
    short: 'Nano',
    logic: 5,
    ide: 'Płytka: Arduino Nano, Procesor: ATmega328P (Old Bootloader) — dla klonów',
    rows: [
      ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RST', 'GND', 'VIN'],
      ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'RX0', 'TX1'],
    ],
    rowNames: ['rząd z A0–A7', 'rząd z D2–D12'],
    supplies: { '5V': ['5V'], '3V3': ['3V3'], VIN: ['VIN'] },
    gnd: ['GND'],
    analog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
    analogOnly: ['A6', 'A7'],
    pwm: ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'],
    i2c: { SDA: 'A4', SCL: 'A5' },
    spi: { MOSI: 'D11', MISO: 'D12', SCK: 'D13' },
    serial: ['RX0', 'TX1'],
    aliases: { D0: 'RX0', D1: 'TX1', RX: 'RX0', TX: 'TX1', '3.3V': '3V3', 'AREF': 'AREF' },
    wokwi: {
      type: 'wokwi-arduino-nano',
      newUrl: 'https://wokwi.com/projects/new/arduino-nano',
      pin: (p, gndIdx) => {
        if (p === 'GND') return 'GND.' + (1 + (gndIdx % 2));
        if (p === '3V3') return '3.3V';
        if (p === 'RX0') return '0';
        if (p === 'TX1') return '1';
        if (/^D\d+$/.test(p)) return p.slice(1);
        return p;
      },
    },
  },

  uno: {
    name: 'Arduino Uno',
    short: 'Uno',
    logic: 5,
    ide: 'Płytka: Arduino Uno',
    rows: [
      ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'TX1', 'RX0'],
      ['IOREF', 'RST', '3V3', '5V', 'GND', 'GND', 'VIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    ],
    rowNames: ['rząd cyfrowy (D0–D13)', 'rząd zasilania i A0–A5'],
    supplies: { '5V': ['5V'], '3V3': ['3V3'], VIN: ['VIN'] },
    gnd: ['GND'],
    analog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    analogOnly: [],
    pwm: ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'],
    i2c: { SDA: 'A4', SCL: 'A5' },
    spi: { MOSI: 'D11', MISO: 'D12', SCK: 'D13' },
    serial: ['RX0', 'TX1'],
    aliases: { D0: 'RX0', D1: 'TX1', RX: 'RX0', TX: 'TX1', '3.3V': '3V3' },
    wokwi: {
      type: 'wokwi-arduino-uno',
      newUrl: 'https://wokwi.com/projects/new/arduino-uno',
      pin: (p, gndIdx) => {
        if (p === 'GND') return 'GND.' + (1 + (gndIdx % 3));
        if (p === '3V3') return '3.3V';
        if (p === 'RX0') return '0';
        if (p === 'TX1') return '1';
        if (/^D\d+$/.test(p)) return p.slice(1);
        return p;
      },
    },
  },

  esp32: {
    name: 'ESP32 DevKit V1 (30 pin)',
    short: 'ESP32',
    logic: 3.3,
    ide: 'Płytka: ESP32 Dev Module (najpierw dodaj ESP32 w Menedżerze płytek)',
    rows: [
      ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'GND', 'D13', 'VIN'],
      ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND', '3V3'],
    ],
    rowNames: ['rząd z EN i VIN', 'rząd z D23 i 3V3'],
    supplies: { '3V3': ['3V3'], VIN: ['VIN'] },
    gnd: ['GND'],
    analog: ['VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'D4', 'D2', 'D15'],
    analogOnly: ['VP', 'VN', 'D34', 'D35'],
    adc2: ['D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'D4', 'D2', 'D15'],
    inputOnly: ['VP', 'VN', 'D34', 'D35'],
    pwm: ['D2', 'D4', 'D5', 'D12', 'D13', 'D14', 'D15', 'D18', 'D19', 'D21', 'D22', 'D23', 'D25', 'D26', 'D27', 'D32', 'D33'],
    i2c: { SDA: 'D21', SCL: 'D22' },
    spi: { MOSI: 'D23', MISO: 'D19', SCK: 'D18' },
    serial: ['RX0', 'TX0'],
    strapping: ['D0', 'D2', 'D12', 'D15', 'D5'],
    aliases: { GPIO36: 'VP', GPIO39: 'VN', D16: 'RX2', D17: 'TX2', D1: 'TX0', D3: 'RX0', '3.3V': '3V3', '5V': 'VIN' },
    wokwi: {
      type: 'wokwi-esp32-devkit-v1',
      newUrl: 'https://wokwi.com/projects/new/esp32',
      pin: (p, gndIdx) => {
        if (p === 'GND') return 'GND.' + (1 + (gndIdx % 2));
        if (p === 'TX2') return 'TX2';
        if (p === 'RX2') return 'RX2';
        return p;
      },
    },
  },

  esp8266: {
    name: 'ESP8266 NodeMCU v2/v3',
    short: 'ESP8266',
    logic: 3.3,
    ide: 'Płytka: NodeMCU 1.0 (ESP-12E Module) (najpierw dodaj ESP8266 w Menedżerze płytek)',
    rows: [
      ['A0', 'RSV', 'RSV', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND', '3V3', 'EN', 'RST', 'GND', 'VIN'],
      ['D0', 'D1', 'D2', 'D3', 'D4', '3V3', 'GND', 'D5', 'D6', 'D7', 'D8', 'RX', 'TX', 'GND', '3V3'],
    ],
    rowNames: ['rząd z A0 i VIN', 'rząd z D0–D8'],
    supplies: { '3V3': ['3V3'], VIN: ['VIN'] },
    gnd: ['GND'],
    analog: ['A0'],
    analogOnly: ['A0'],
    pwm: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'],
    i2c: { SDA: 'D2', SCL: 'D1' },
    spi: { MOSI: 'D7', MISO: 'D6', SCK: 'D5' },
    serial: ['RX', 'TX'],
    strapping: ['D3', 'D4', 'D8'],
    aliases: { '3.3V': '3V3', '5V': 'VIN' },
    wokwi: null, // Wokwi nie ma ESP8266
  },
};

export function getBoard(id) {
  return BOARDS[id] || null;
}

// Normalizuje nazwę pinu płytki (aliasy, wielkość liter).
export function normPin(board, p) {
  if (!p) return p;
  let s = String(p).trim().toUpperCase().replace(/^GPIO(\d+)$/, 'D$1');
  if (/^\d+$/.test(s)) s = 'D' + s;
  if (board.aliases && board.aliases[s]) s = board.aliases[s];
  return s;
}

export function allPins(board) {
  return new Set(board.rows.flat());
}

export function pinRole(board, p) {
  if (board.gnd.includes(p)) return 'gnd';
  for (const [k, v] of Object.entries(board.supplies)) if (v.includes(p)) return 'supply:' + k;
  return 'signal';
}

// Gdzie fizycznie jest pin — do instrukcji "jak w realu".
export function pinLocation(board, p) {
  for (let r = 0; r < board.rows.length; r++) {
    const idx = board.rows[r].indexOf(p);
    if (idx >= 0) {
      const n = idx + 1;
      return `${board.rowNames[r]}, ${n}. pin od strony USB`;
    }
  }
  return '';
}

export function pinTags(board, p) {
  const t = [];
  if (board.gnd.includes(p)) t.push('GND');
  for (const [k, v] of Object.entries(board.supplies)) if (v.includes(p)) t.push(k);
  if (board.analog.includes(p)) t.push('analog');
  if (board.pwm.includes(p)) t.push('PWM');
  if (board.i2c.SDA === p) t.push('I2C SDA');
  if (board.i2c.SCL === p) t.push('I2C SCL');
  if (board.serial.includes(p)) t.push('Serial');
  if (board.inputOnly && board.inputOnly.includes(p)) t.push('tylko wejście');
  if (board.strapping && board.strapping.includes(p)) t.push('pin startowy');
  return t;
}
