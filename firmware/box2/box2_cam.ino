/*
  Box2 (dalam): ESP32-CAM (AI-Thinker)
  - Fungsi utama: capture image saat tombol scan dipencet, kirim ke server /api/recognize
  - Terima response part_id dan tampilkan pada serial atau pada display
  - Untuk prototyping, gunakan tombol untuk trigger capture
*/

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// Replace with your network
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASS";
const char* serverUrl = "http://SERVER_IP:5000/api/recognize";

// Pin definitions for AI-Thinker ESP32-CAM
#define PWDN_GPIO_NUM    32
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM    0
#define SIOD_GPIO_NUM    26
#define SIOC_GPIO_NUM    27
#define Y9_GPIO_NUM      35
#define Y8_GPIO_NUM      34
#define Y7_GPIO_NUM      39
#define Y6_GPIO_NUM      36
#define Y5_GPIO_NUM      21
#define Y4_GPIO_NUM      19
#define Y3_GPIO_NUM      18
#define Y2_GPIO_NUM      5
#define VSYNC_GPIO_NUM   25
#define HREF_GPIO_NUM    23
#define PCLK_GPIO_NUM    22

const int pinScan = 13; // tombol scan
const int pinFinalize = 14; // tombol finalize borrow
const int pinQty = 12; // tombol increase qty (prototype)

// session key must be set (from Box1 response) for add_part/finalize calls
String session_key = ""; // set via Serial: send 'SESSION:<id>'
int currentQty = 1;
const char* addPartUrl = "http://SERVER_IP:5000/api/session/add_part"; // update server IP
const char* finalizeUrl = "http://SERVER_IP:5000/api/session/finalize_borrow";

void startCameraServer(){
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_SVGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(pinScan, INPUT_PULLUP);
  pinMode(pinFinalize, INPUT_PULLUP);
  pinMode(pinQty, INPUT_PULLUP);
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print('.'); }
  Serial.println(" connected");
  startCameraServer();
}

void loop() {
  if (digitalRead(pinScan) == LOW) {
    Serial.println("Capture triggered");
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      delay(1000);
      return;
    }

    // POST multipart/form-data image
    if (WiFi.status()==WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverUrl);
      String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
      http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
      // build body manually (may be heavy on memory) — for prototyping small images
      String head = "--" + boundary + "\r\n";
      head += "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n";
      head += "Content-Type: image/jpeg\r\n\r\n";

      // send head
      WiFiClient * stream = http.getStreamPtr();
      http.sendRequest("POST", head);
      stream->write(fb->buf, fb->len);
      // send tail
      String tail = "\r\n--" + boundary + "--\r\n";
      stream->print(tail);

      int statusCode = http.responseStatusCode();
      String resp = http.responseBody();
      Serial.printf("Status: %d\n", statusCode);
      Serial.println(resp);
      http.end();

      // parse simple JSON response to extract part_id (naive parse)
      String part_id = "";
      int idx = resp.indexOf("part_id");
      if (idx >= 0) {
        int colon = resp.indexOf(':', idx);
        if (colon >= 0) {
          int quote1 = resp.indexOf('"', colon);
          int quote2 = resp.indexOf('"', quote1+1);
          if (quote1>=0 && quote2>quote1) part_id = resp.substring(quote1+1, quote2);
        }
      }
      if (part_id.length() > 0) {
        Serial.println("Recognized part: " + part_id);
        // call add_part endpoint if session_key known
        if (session_key.length() > 0) {
          HTTPClient http2;
          http2.begin(addPartUrl);
          http2.addHeader("Content-Type", "application/json");
          String payload = "{";
          payload += "\"session_key\":\"" + session_key + "\",";
          payload += "\"part_id\":\"" + part_id + "\",";
          payload += "\"qty\":" + String(currentQty) + "}";
          int code2 = http2.POST(payload);
          String resp2 = http2.getString();
          Serial.println("Add part response: " + resp2);
          http2.end();
          // reset qty
          currentQty = 1;
        } else {
          Serial.println("No session_key set. Use Serial: SESSION:<id>");
        }
      } else {
        Serial.println("No part recognized");
      }
    }

    esp_camera_fb_return(fb);
    delay(1000);
  }
  // qty button
  if (digitalRead(pinQty) == LOW) {
    currentQty++;
    Serial.printf("Qty now: %d\n", currentQty);
    delay(400);
  }
  // finalize borrow button
  if (digitalRead(pinFinalize) == LOW) {
    if (session_key.length() == 0) {
      Serial.println("No session_key set. Cannot finalize.");
    } else {
      Serial.println("Finalizing borrow for session: " + session_key);
      HTTPClient httpf;
      httpf.begin(finalizeUrl);
      httpf.addHeader("Content-Type", "application/json");
      String payload = "{";
      payload += "\"session_key\":\"" + session_key + "\",";
      payload += "\"name\":\"\",\"nim\":\"\"}";
      int codef = httpf.POST(payload);
      String respf = httpf.getString();
      Serial.println("Finalize response: " + respf);
      httpf.end();
    }
    delay(800);
  }

  // Serial input to set session key or finalize return, simple commands
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.startsWith("SESSION:")) {
      session_key = line.substring(8);
      Serial.println("Session key set: " + session_key);
    } else if (line.startsWith("FINALIZE_RETURN:")) {
      String loan_key = line.substring(16);
      Serial.println("Finalize return for loan: " + loan_key);
      // simple finalize return call (no part verification here)
      HTTPClient httpf;
      httpf.begin("http://SERVER_IP:5000/api/session/finalize_return");
      httpf.addHeader("Content-Type", "application/json");
      String payload = "{";
      payload += "\"loan_key\":\"" + loan_key + "\"}";
      int codef = httpf.POST(payload);
      String respf = httpf.getString();
      Serial.println("Finalize return response: " + respf);
      httpf.end();
    }
  }
  delay(200);
}
