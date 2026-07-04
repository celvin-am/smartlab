/*
  Box1 (luar): ESP32 + MFRC522 + Keypad + I2C LCD
  - Fungsi: baca RFID KTM saat user tekan tombol 'PINJAM' atau 'RETURN' di keypad
  - Kirim event ke server (HTTP POST) untuk borrow_start atau return_start
  Note: sesuaikan pin MFRC522 dengan wiring Anda.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// === CONFIG ===
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASS";
const char* serverUrl = "http://SERVER_IP:5000/api/rfid_event"; // ganti server address

// MFRC522 pins (contoh)
#define RST_PIN  16
#define SS_PIN   5
MFRC522 mfrc522(SS_PIN, RST_PIN);

LiquidCrystal_I2C lcd(0x27,16,2);

// Simple keypad emulation: for prototype, kita pakai satu tombol pin untuk 'PINJAM' dan satu untuk 'RETURN'
const int pinButtonBorrow = 14; // tombol pinjam
const int pinButtonReturn = 12; // tombol return

void setup() {
  Serial.begin(115200);
  pinMode(pinButtonBorrow, INPUT_PULLUP);
  pinMode(pinButtonReturn, INPUT_PULLUP);

  Wire.begin();
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.print("Box1 Ready");

  SPI.begin();
  mfrc522.PCD_Init();

  WiFi.begin(ssid, password);
  lcd.setCursor(0,1); lcd.print("WiFi connecting");
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println(" connected");
  lcd.clear(); lcd.print("WiFi OK");
}

String uidToString(MFRC522::Uid uid){
  String out = "";
  for (byte i=0;i<uid.size;i++){
    out += String(uid.uidByte[i], HEX);
  }
  out.toUpperCase();
  return out;
}

void sendRfidEvent(const char* box, const char* action, const char* uid){
  if (WiFi.status()!=WL_CONNECTED) return;
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type","application/json");
  String payload = "{";
  payload += "\"box\":\"" + String(box) + "\",";
  payload += "\"action\":\"" + String(action) + "\",";
  payload += "\"uid\":\"" + String(uid) + "\"}";
  int code = http.POST(payload);
  Serial.println("POST payload: " + payload);
  Serial.println("HTTP code:" + String(code));
  String resp = http.getString();
  Serial.println("Response: " + resp);
  // show short response on LCD
  lcd.clear();
  if (resp.length() > 0) {
    String s = resp;
    if (s.length() > 32) s = s.substring(0,32);
    lcd.print(s);
  } else {
    lcd.print("OK");
  }
  delay(2000);
  http.end();
}

void loop() {
  // check buttons
  if (digitalRead(pinButtonBorrow) == LOW) {
    lcd.clear(); lcd.print("Tap KTM for Pinjam");
    // wait for card
    while (true) {
      if ( ! mfrc522.PICC_IsNewCardPresent()) { delay(200); continue; }
      if ( ! mfrc522.PICC_ReadCardSerial()) { delay(200); continue; }
      String uid = uidToString(mfrc522.uid);
      lcd.clear(); lcd.print("UID:"); lcd.setCursor(0,1); lcd.print(uid);
      sendRfidEvent("box1","borrow_start", uid.c_str());
      delay(1000);
      break;
    }
  }
  if (digitalRead(pinButtonReturn) == LOW) {
    lcd.clear(); lcd.print("Tap KTM for Return");
    while (true) {
      if ( ! mfrc522.PICC_IsNewCardPresent()) { delay(200); continue; }
      if ( ! mfrc522.PICC_ReadCardSerial()) { delay(200); continue; }
      String uid = uidToString(mfrc522.uid);
      lcd.clear(); lcd.print("UID:"); lcd.setCursor(0,1); lcd.print(uid);
      sendRfidEvent("box1","return_start", uid.c_str());
      delay(1000);
      break;
    }
  }
  delay(200);
}
