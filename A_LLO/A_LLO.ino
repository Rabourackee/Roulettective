/*
This is a simple example that allows you to connect 4 buttons and a rotary encoder to your Arduino.
The Arduino acts as a keyboard by outputting button presses.

You will need this table to figure the code for the characters you are trying to output.
http://www.asciitable.com/
*/

#include <Keyboard.h>     // include library that let's Arduino act as a keyboard

#include <RotaryEncoder.h> // include rotary encoder library
#include <Adafruit_DotStar.h>
#include <SPI.h>

// Setup a RoraryEncoder for pins A0 and A1:
RotaryEncoder encoder2(A0, A1);
RotaryEncoder encoder1(A2, A3);

// some useful values
#define OFF 0
#define ON 1

// start by assuming no buttons are pressed
// A is the rotery encoder button for player1
// B is the button for player1
// X is the rotery encoder button for player2
// Y is the button for player2
bool keyA = OFF;
bool keyB = OFF;
bool keyC = OFF;
bool keyD = OFF;

// Number of LEDs per strip (0-6 means 7 LEDs total)
#define NUM_LEDS 7

// Define pin numbers for the two DotStar strips
// Adjust these pins to match your wiring.
#define DATAPIN1 6
#define CLOCKPIN1 7

#define DATAPIN2 8
#define CLOCKPIN2 9

// // Create two DotStar objects for the two LED strips
Adafruit_DotStar strip1 = Adafruit_DotStar(NUM_LEDS, DATAPIN1, CLOCKPIN1, DOTSTAR_BRG);
Adafruit_DotStar strip2 = Adafruit_DotStar(NUM_LEDS, DATAPIN2, CLOCKPIN2, DOTSTAR_BRG);

// 定义按钮组合检测所需变量
unsigned long lastButtonChangeTime = 0;
const unsigned long debounceDelay = 1000; // 100ms防抖动窗口
bool combinationStable = false;
byte currentCombination = 0; // 用于存储当前按钮组合的位模式
byte lastSentCombination = 0xFF; // 上次发送的组合，初始化为无效值

// 添加一个映射函数将按钮组合映射到键盘按键码
int getCombinationKeyCode(byte combination) {
  // 保留原有的几种组合，其他可以根据需要修改
  switch(combination) {
    case 0b0000: return 0;       // 无按钮按下 - 不发送任何键
    case 0b1000: return 69;      // E键 - 只有按钮A按下
    case 0b0100: return 67;      // C键 - 只有按钮B按下
    case 0b0010: return 88;      // X键 - 只有按钮C按下
    case 0b0001: return 86;      // V键 - 只有按钮D按下
    case 0b1111: return 82;      // R键 - 所有按钮同时按下
    
    // 其他组合可以按需添加
    case 0b1100: return 65;      // A键 - 按钮A和B同时按下
    case 0b1010: return 66;      // B键 - 按钮A和C同时按下
    case 0b1001: return 68;      // D键 - 按钮A和D同时按下
    case 0b0110: return 70;      // F键 - 按钮B和C同时按下
    case 0b0101: return 71;      // G键 - 按钮B和D同时按下
    case 0b0011: return 72;      // H键 - 按钮C和D同时按下
    case 0b1110: return 73;      // I键 - 按钮A、B和C同时按下
    case 0b1101: return 74;      // J键 - 按钮A、B和D同时按下
    case 0b1011: return 75;      // K键 - 按钮A、C和D同时按下
    case 0b0111: return 76;      // L键 - 按钮B、C和D同时按下
    default: return 0;
  }
}

void updateStrip(Adafruit_DotStar &strip, int count, int red, int blue) {
  // Ensure count is within bounds
  if(count < 0) count = 0;
  if(count > NUM_LEDS) count = NUM_LEDS;
  
  for (int i = 0; i < NUM_LEDS; i++) {
    if (i < count) {
      // Set lit LED color to white (adjust RGB values if needed)
      strip.setPixelColor(i, 0, red, blue);
    } else {
      // Turn off LED
      strip.setPixelColor(i, 0, 0, 0);
    }
  }
  strip.show(); // Update the strip with new data
}

void setup() {
  // connect to serial port for debugging
  Serial.begin(57600);

  // make pin 2 an input and turn on the
  // pullup resistor so it goes high unless
  // connected to ground:
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT_PULLUP);
  pinMode(4, INPUT_PULLUP);
  pinMode(5, INPUT_PULLUP);

  // start the keyboard
  Keyboard.begin();

  // Initialize both DotStar LED strips.
  strip1.begin(); 
  strip1.show(); // Initialize all pixels to 'off'
  
  strip2.begin(); 
  strip2.show(); // Initialize all pixels to 'off'
}

void loop() {
  // 处理LED条和串行通信
  if (Serial.available() > 0) {
    // Use parseInt() to read numbers. They will be 0 if none found.
    int num1 = Serial.parseInt();
    int num2 = Serial.parseInt();
    
    // Wait for the end of line to ensure we got the full message
    while (Serial.available() > 0) {
      char c = Serial.read();
      if(c == '\n') break;
    }
    
    // Debug output:
    // Serial.print("Received numbers: ");
    // Serial.print(num1);
    // Serial.print(" and ");
    // Serial.println(num2);
    
    // Update LED strips based on the received numbers.
    updateStrip(strip1, num1, 100, 0);
    updateStrip(strip2, num2, 0, 100);
  }

  // 读取当前按钮状态
  bool currentKeyA = (digitalRead(2) == HIGH);
  bool currentKeyB = (digitalRead(3) == HIGH);
  bool currentKeyC = (digitalRead(4) == HIGH);
  bool currentKeyD = (digitalRead(5) == HIGH);
  
  // 将按钮状态更新到我们的内部变量
  // 注意：这里我们直接设置ON/OFF状态，不再使用之前的触发逻辑
  keyA = currentKeyA ? ON : OFF;
  keyB = currentKeyB ? ON : OFF;
  keyC = currentKeyC ? ON : OFF;
  keyD = currentKeyD ? ON : OFF;
  
  // 计算按钮组合的位模式
  byte newCombination = 0;
  if (keyA == ON) newCombination |= 0b1000;
  if (keyB == ON) newCombination |= 0b0100;
  if (keyC == ON) newCombination |= 0b0010;
  if (keyD == ON) newCombination |= 0b0001;
  
  // 如果按钮状态改变，记录时间
  if (newCombination != currentCombination) {
    lastButtonChangeTime = millis();
    combinationStable = false;
    currentCombination = newCombination;
  }
  
  // 检查按钮状态是否保持稳定一段时间
  if (!combinationStable && (millis() - lastButtonChangeTime > debounceDelay)) {
    combinationStable = true;
    // 获取匹配的键码
    int keyCode = getCombinationKeyCode(currentCombination);
    
    // 只有在有效键码时才发送，且与上次发送的不同
    if (keyCode > 0 && currentCombination != lastSentCombination) {
      Keyboard.write(keyCode);
      lastSentCombination = currentCombination;
      
      // 输出调试信息
      Serial.print("Button combination: ");
      Serial.print(currentCombination, BIN);
      Serial.print(" - Sending key code: ");
      Serial.println(keyCode);
    }
  }
  
  // 如果所有按钮都释放，重置上次发送的组合
  if (currentCombination == 0) {
    lastSentCombination = 0xFF; // 重置为无效值，允许再次检测组合
  }
}