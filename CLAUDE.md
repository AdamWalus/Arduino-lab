# Arduino Lab — instrukcja dla Claude

Strona: **https://adamwalus.github.io/Arduino-lab/** (GitHub Pages, wdraża się sama po pushu na `main`, ok. 1 min).
Wejście chronione PIN-em 3078 (tylko kosmetycznie — repo jest publiczne).

## Kim jest użytkownik i jak z nim gadać

- Adam Waluś, grupa 1a, UBB (Wydział Budowy Maszyn i Informatyki). Przedmiot: **Rozszerzony Internet Rzeczy**, prowadzący **dr Łukasz Więcław**.
- Na labach: Arduino Nano (klon — w IDE „ATmega328P (Old Bootloader)”), czasem ESP32/ESP8266. Sprawdza w Wokwi, składa w realu na płytce stykowej.
- Pisze głównie z telefonu, często krótko i potocznie. Odpowiadaj **krótko i konkretnie**, bez lania wody i dopisków, o które nie pytał.
- Tłumacz **jak dziecku**, na prostych przykładach (kranik, drogi, nietoperz…). **Nie** na rurach/kanalizacji.
- Jak mówi „chcę zrobić sam” — dawaj kierunek, nie gotowca.
- Jak coś pokazuje na zdjęciu — patrz uważnie na piny i kolumny płytki, nie zgaduj.

## Standardowe zadanie: „zrób X”

0. **Najpierw, zanim cokolwiek zrobisz w repo**, napisz w czacie słownie, co i jak podłączyć (jak dziecku: która nóżka do którego pinu i dlaczego). Dopiero potem siadaj do roboty (kroki 1–4).
1. Dodaj projekt w `projects/RRRR-MM-DD-krotka-nazwa/` (dzisiejsza data, małe litery, myślniki):
   - `project.json` (format niżej),
   - `sketch.ino` (kod),
   - zdjęcia, jeśli są.
2. Uruchom `node scripts/check.mjs`. Nadaje projektowi numer `n` i przebudowuje `projects/index.json`.
   **Jak są błędy — popraw. Nie wypychaj z błędami.** Uwagi (żółte) przeczytaj i oceń.
3. Commit + push na `main`.
4. Odpowiedź w czacie, zawsze w tym układzie:
   - **Na początku link**: `https://adamwalus.github.io/Arduino-lab/#N` (N = numer projektu).
   - Potem **krótko wytłumacz w czacie co i jak** — jak dziecku: co robi układ, co gdzie się podłącza i dlaczego (np. „D13 to kranik, rezystor zwęża, GND to powrót”), co nowego w kodzie. Kilka punktów, bez lania wody.
   - **Na końcu znowu ten sam link.**
   - Całego kodu nie wklejaj do czatu, chyba że prosi.
5. Zmiana w istniejącym projekcie: edytuj jego pliki, check, push, ten sam link.

Jeśli nie da się wypchnąć (brak dostępu), powiedz to wprost i daj kod/instrukcję w czacie.

## Twarde zasady podłączeń (świat realny)

- Podłączanie przy **odpiętym USB**, USB na końcu.
- **Dioda zawsze z rezystorem** (220 Ω), każda swój.
- **5V nigdy z GND**. Moduły 3,3V (BMP280, większość czujników do ESP) **nie na 5V**.
- **Jedna dziurka = jeden kabel.** Kilka połączeń do jednego punktu → ta sama kolumna (5 dziurek) albo szyna. Nigdy „dwa kable w jednej dziurce” i żadnych skrótów niewykonalnych fizycznie.
- Kabel łączy tylko swoje dwa końce — przechodzenie „nad” czymś nic nie łączy.
- Przyciski i moduły dwurzędowe **nad środkowym rowkiem** płytki.
- Nano ma 2 piny GND — przy więcej niż 2 odbiorcach GND wyprowadź na szynę/kolumnę (napisz to w krokach).
- Nie używaj D0/D1 (RX/TX). Na ESP32 unikaj pinów startowych (D0, D2, D12, D15) i ADC2 przy WiFi.
- Części, których nie ma w `data/inventory.json`: checker to zgłosi — zaproponuj zamiennik z magazynu albo wprost napisz, co trzeba kupić/pożyczyć.

## Format `project.json`

```json
{
  "slug": "2026-11-04-termometr",          // = nazwa folderu
  "title": "Termometr DHT11",
  "date": "2026-11-04",
  "board": "nano",                         // nano | uno | esp32 | esp8266  (js/boards.js)
  "summary": "Jedno zdanie, co robi.",
  "tags": ["dht11"],
  "parts": [
    { "id": "r1", "type": "resistor", "value": "220Ω" },
    { "id": "led1", "type": "led", "color": "red" },
    { "id": "x", "type": "module", "name": "Coś nowego", "pins": ["VCC", "GND", "OUT"], "vcc": [3.3, 5] }
  ],
  "wires": [
    { "from": "board:D13", "to": "r1:1", "color": "orange", "note": "opcjonalna uwaga" },
    { "from": "r1:2", "to": "led1:A" },
    { "from": "led1:C", "to": "board:GND", "color": "black" }
  ],
  "steps": ["Krok w realu, **pogrubienia** i `kod` działają."],
  "explain": ["Jak to działa — prosto."],
  "expected": "Co ma się stać.",
  "troubleshooting": ["Nie działa? ..."],
  "codeFile": "sketch.ino",
  "libraries": ["Adafruit BMP280 Library"],
  "images": [{ "src": "foto.jpg", "caption": "…", "report": "connection|results" }],
  "report": { … }                          // tylko gdy prosi o sprawozdanie (niżej)
}
```

- Piny płytki: dokładnie jak na płytce (`D13`, `A0`, `5V`, `3V3`, `GND`, `VIN`; ESP32: `D21`, `VP`…). Lista w `js/boards.js`.
- Typy części i ich piny: `js/parts.js` (led, resistor, button, buzzer, potentiometer, ldr, ldr-module, hc-sr04, bmp280, dht11, dht22, ds18b20, servo, lcd-i2c, oled, rgb-led, relay, pir, module).
- **Brak części w bibliotece?** Użyj `"type": "module"` z `pins` i `vcc` — narysuje się jako ogólny prostokąt. Jeśli część będzie się powtarzać, dopisz ją do `js/parts.js` (piny, role, vcc, opis, wokwi albo `null`).
- **Brak płytki?** Dopisz do `js/boards.js` (rzędy pinów od strony USB, zasilania, analog, PWM, I2C).
- Kolory kabli: red, black, blue, green, yellow, orange, white, grey, purple, brown, limegreen, gold, cyan, pink. GND = black, 5V = red.
- Kroki (`steps`) piszesz pod **prawdziwą płytkę stykową**: kolumny, szyny, który pin GND — tak, żeby dało się to złożyć bez myślenia. Każdy kabel w osobnej dziurce.

## Widok płytki stykowej

Strona sama rozmieszcza części na płytce stykowej (`js/breadboard.js`) i generuje listę „co gdzie wpiąć” (dziurki typu `e12`, szyny +/−). Tryb lab odhacza właśnie tę listę. Nano/ESP leży obok płytki i łączy się kabelkami (tak jak na labach).

- Domyślnie płytka **bez szyn** (Adam ich nie używa — nie każda jego płytka je ma). GND rozprowadzane wspólnymi kolumnami i dwoma pinami GND Nano, jak najmniej kabli (nóżki części wpinane prosto w kolumny tej samej sieci). Z szynami: `"breadboard": "rails"`, mała 30 kolumn: `"mini"`, bez widoku: `false`.
- Kabli ma mało — projektuj tak, żeby było ich jak najmniej.
- Podgląd w terminalu: `node scripts/bb.mjs <slug>` — jak piszesz `steps` z numerami dziurek, bierz je stąd, żeby zgadzały się z obrazkiem.
- Zawsze są **dwa schematy**: logiczny (szyny 5V/GND, `js/diagram.js`) i płytka stykowa.
- **Oznaczenia na płytce (Adam ich wymaga przy każdej części, też nowej):**
  - przy nóżkach: dokąd idą (pin Nano, np. `D10`, `GND`), diody `+`/`−`, buzzer `+`/`−` pod spodem;
  - przycisk: 4 nóżki w rogach, przy używanych `D2`/`GND`; napis „przycisk” na korpusie;
  - moduły: nazwy pinów na korpusie modułu;
  - napisy **na częściach**, nie obok; bez zbędnych podpisów (nazwy diod, wartości rezystorów itp. — nie).
  - Nowa część dwunóżkowa → dopisz typ do `TWO_LEG`/`SPAN` w `js/breadboard.js`; wielonóżkowa rysuje się jako moduł z nazwami pinów. Po dodaniu obejrzyj rysunek płytki (np. zrzut Playwrightem) i sprawdź, czy oznaczenia są czytelne.
- Kable na płytce: kąty proste, pionowe odcinki między kolumnami (nie zasłaniać dziurek i numerów), czarne kable z jasną obwódką, ciemne tło.

## Sprawozdanie (`report`)

Strona `#/raport/<slug>` robi PDF (strona tytułowa UBB + sekcje). Dane studenta są w `data/settings.json`.

```json
"report": {
  "lab": "3", "topic": "…", "date": "2026-11-04",
  "goal": "…", "needed": ["…"], "connection": "…", "diagram": true,
  "program": "…", "programAfter": "…",
  "results": [{ "text": "…", "table": { "head": ["…"], "rows": [["…"]] }, "image": "x.jpg", "caption": "…" }],
  "conclusions": ["…", "…"]
}
```

Styl sprawozdań: **luźny język studenta**, pierwsza osoba („podłączyłem”), bez wulgaryzmów, bez „AI slopu” (żadnego „warto zauważyć”, „podsumowując”, list zalet). Krótkie akapity. Tylko to, co faktycznie było na labach — nie dopisuj rzeczy, których nie robił (np. wysokości, jeśli jej nie chciał). Wyniki z jego zdjęć ekranu przepisuj dokładnie.

## Magazyn

`data/inventory.json` — co ma pod ręką. Jak napisze „mam X” / „dodaj do magazynu” / „nie mam Y” — zaktualizuj i wypchnij.

## Struktura

- `index.html`, `css/app.css`, `js/*.js` — aplikacja (bez builda, czyste moduły ES).
- `js/check.js` — kontrola bezpieczeństwa (używana i w przeglądarce, i w `scripts/check.mjs`, i w CI).
- `js/diagram.js` — schemat logiczny; `js/breadboard.js` — płytka stykowa; `js/wokwi.js` — eksport do Wokwi; `js/report.js` — sprawozdanie.
- `.github/workflows/pages.yml` — check + deploy na Pages.
- Po zmianie plików aplikacji podbij wersję cache w `sw.js` (`const V = 'al-vN'`).
