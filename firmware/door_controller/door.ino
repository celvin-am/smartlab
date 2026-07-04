/*
  Door controller: ESP32 + Relay + optional RFID for exit
  - Menerima perintah open/close dari server (atau via simple HTTP GET)
  - Pin relay aktif HIGH untuk membuka elektromagnet (sesuaikan)
*/

#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASS";

const int relayPin = 2; // ganti sesuai wiring
WebServer server(80);

void handleOpen(){
  digitalWrite(relayPin, HIGH); // open
  server.send(200, "text/plain", "OPENED");
}
void handleClose(){
  digitalWrite(relayPin, LOW); // close
  server.send(200, "text/plain", "CLOSED");
}

void setup(){
  Serial.begin(115200);
  pinMode(relayPin, OUTPUT); digitalWrite(relayPin, LOW);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print('.'); }
  Serial.println("WiFi connected");

  server.on("/open", handleOpen);
  server.on("/close", handleClose);
  server.begin();
}

void loop(){
  server.handleClient();
}
