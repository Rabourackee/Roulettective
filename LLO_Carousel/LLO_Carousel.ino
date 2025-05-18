#include <SPI.h>
#include <MFRC522.h>
#include <Keyboard.h>
#include <Servo.h>

#define SS_PIN 10    // 把RC522的SDA接到 D10
#define RST_PIN 9    // 把RC522的RST接到 D9
#define stepPin 2
#define dirPin 3
#define limitSwitchPin 4
#define LAMP_PIN 7   // 小灯泡连接到7号接口

MFRC522 rfid(SS_PIN, RST_PIN); // 创建 RFID 实例
Servo myServo;

// 存储卡片UID和对应按键的映射
struct {
  byte uid[7];
  char key;
} cardMapping[] = {
  {{0x04, 0xD1, 0xA3, 0x85, 0x73, 0x00, 0x00}, 'I'},
  {{0x04, 0x89, 0x36, 0x22, 0x7F, 0x61, 0x80}, 'I'},
  {{0x04, 0xF0, 0xEC, 0x84, 0x73, 0x00, 0x00}, 'I'},

  {{0x04, 0x49, 0xB8, 0x84, 0x73, 0x00, 0x00}, 'E'},
  {{0x04, 0x99, 0x4A, 0x26, 0x8F, 0x61, 0x80}, 'E'},
  {{0x04, 0x64, 0x02, 0x85, 0x73, 0x00, 0x00}, 'E'},
  {{0x04, 0xCB, 0xCC, 0x84, 0x73, 0x00, 0x00}, 'E'},
  {{0x04, 0x17, 0x92, 0x85, 0x73, 0x00, 0x00}, 'E'},
  {{0x04, 0xE0, 0x26, 0x25, 0x8F, 0x61, 0x80}, 'E'},

  {{0x04, 0x83, 0x66, 0x85, 0x73, 0x00, 0x00}, 'C'},
  {{0x04, 0xB4, 0xB3, 0x85, 0x73, 0x00, 0x00}, 'C'},
  {{0x04, 0x45, 0xD5, 0x84, 0x73, 0x00, 0x00}, 'C'},
  {{0x04, 0x1C, 0x23, 0x23, 0x8F, 0x61, 0x81}, 'C'},
  {{0x04, 0x1E, 0x11, 0x21, 0x7F, 0x61, 0x80}, 'C'},
  {{0x04, 0x90, 0x19, 0x20, 0x7F, 0x61, 0x80}, 'C'},

  {{0x04, 0x27, 0x49, 0x85, 0x73, 0x00, 0x00}, 'L'},
  {{0xAC, 0xFE, 0xE7, 0x00}, 'L'},
  {{0x04, 0x55, 0x69, 0x85, 0x73, 0x00, 0x00}, 'L'},
  {{0xE3, 0x0E, 0xE5, 0x00}, 'L'},
  {{0x04, 0xDA, 0x5E, 0x85, 0x73, 0x00, 0x00}, 'L'},

  {{0x04, 0xD5, 0x10, 0x07, 0x6F, 0x61, 0x80}, 'A'},
  {{0x04, 0x53, 0xE5, 0x85, 0x73, 0x00, 0x00}, 'A'},
  {{0xE5, 0x4B, 0xF5, 0x00}, 'A'},
  {{0x32, 0x89, 0xE9, 0x00}, 'A'},

  {{0x04, 0x39, 0x26, 0x85, 0x73, 0x00, 0x00}, 'V'},

  {{0x04, 0x0B, 0xB3, 0x84, 0x73, 0x00, 0x00}, '1'},
  {{0x04, 0xF8, 0x9E, 0x85, 0x73, 0x00, 0x00}, '2'},
  {{0x04, 0x3B, 0x93, 0x85, 0x73, 0x00, 0x00}, '3'},
  {{0x04, 0x52, 0x9D, 0x85, 0x73, 0x00, 0x00}, '4'},
  {{0x04, 0x06, 0x25, 0x23, 0x8F, 0x61, 0x80}, '5'},
};

// 用于跟踪上一次读取的卡片UID
byte lastUid[7] = {0, 0, 0, 0, 0, 0, 0};
bool cardPresent = false;

const int stepDelay = 1000;
const int exitSteps = 15;
const int minStepsPerRev = 100;  // 每圈最少走 100 步

int servomin = 32;
int servomax = 90;

// 按钮定义
const int buttonPins[] = {A0, A1, A2};
const char keys[] = {'F', 'B', 'R'};

bool lastStates[3] = {HIGH, HIGH, HIGH};  // 上一次读取的稳定状态
unsigned long lastTimes[3] = {0, 0, 0};
const unsigned long debounceDelay = 30;   // 防抖延迟（毫秒）

// 记录上次电机旋转方向，用于自检逻辑
bool lastRotationForward = true;  // true表示正转，false表示反转

// 记录电机旋转圈数，正值表示正向累计圈数，负值表示反向累计圈数
int rotationCount = 0;

// 用于电脑控制灯泡的变量
bool lampState = false;
unsigned long lastSerialCheck = 0;
const unsigned long serialCheckInterval = 100; // 每100ms检查一次串口

void setup() {
  Serial.begin(9600);
  while (!Serial);   // 等待串口连接（Pro Micro上需要）
  
  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(limitSwitchPin, INPUT);
  pinMode(LAMP_PIN, OUTPUT);  // 设置灯泡引脚为输出模式
  digitalWrite(LAMP_PIN, LOW); // 初始状态为关闭

  // 初始化按钮
  for (int i = 0; i < 3; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
  }

  myServo.attach(6);
  myServo.write(servomax);  // 初始化舵机位置为最大值
  
  SPI.begin();       // 启动SPI
  rfid.PCD_Init();   // 初始化RC522
  Keyboard.begin();  // 初始化键盘功能
  
  Serial.println("RFID到键盘映射程序已启动");
  Serial.println("请把你的RFID卡靠近读卡器...");
  Serial.println("系统初始化完成，等待按钮输入...");
  Serial.println("灯泡控制功能已启用，等待电脑指令...");

  // 初始化时先执行一次归零操作
  homeStepperMotor();
  
  // 初始化旋转计数器
  rotationCount = 0;
}

void loop() {
  // 检查串口是否有新数据
  unsigned long currentMillis = millis();
  if (currentMillis - lastSerialCheck >= serialCheckInterval) {
    lastSerialCheck = currentMillis;
    
    if (Serial.available() > 0) {
      char cmd = Serial.read();
      
      // 处理灯泡控制命令
      if (cmd == '1') {  // 打开灯泡
        digitalWrite(LAMP_PIN, HIGH);
        lampState = true;
        Serial.println("灯泡已打开");
      } 
      else if (cmd == '0') {  // 关闭灯泡
        digitalWrite(LAMP_PIN, LOW);
        lampState = false;
        Serial.println("灯泡已关闭");
      }
      
      // 清空剩余的串口缓冲区
      while (Serial.available() > 0) {
        Serial.read();
      }
    }
  }

  // 检查按钮状态
  for (int i = 0; i < 3; i++) {
    int reading = digitalRead(buttonPins[i]);

    // 状态变化了，开始防抖计时
    if (reading != lastStates[i]) {
      lastTimes[i] = millis();
      lastStates[i] = reading;
    }

    // 检查是否稳定保持了 LOW 超过 debounceDelay
    if ((millis() - lastTimes[i]) > debounceDelay) {
      if (reading == LOW) {
        // 按下按钮后执行相应操作
        Serial.print("按下按钮: ");
        Serial.println(keys[i]);
        
        // 发送对应键盘按键
        Keyboard.write(keys[i]);
        
        // 执行按钮对应的操作序列
        if (i == 0) {  // A0 按钮 - 执行序列1
          executeSequence1();
        } else if (i == 1) {  // A1 按钮 - 执行序列2
          executeSequence2();
        } else if (i == 2) {  // A2 按钮 - 执行重置序列
          executeResetSequence();
        }
        
        // 等待按钮释放
        while (digitalRead(buttonPins[i]) == LOW);
        delay(10);  // 稍作缓冲，防止误触
      }
    }
    
    lastStates[i] = reading;
  }
}

// A0按钮对应的序列：servo max到min, stepper正转一圈，servo min到max，读取RFID
void executeSequence1() {
  Serial.println("执行序列1...");
  
  // 1. Servo from max to min
  servoMaxToMin();
  
  // 2. Stepper motor forward rotation with self-check
  stepperRotateForward();
  rotationCount++; // 增加正向旋转计数
  Serial.print("当前旋转计数: ");
  Serial.println(rotationCount);
  
  // 3. Servo from min to max
  servoMinToMax();
  
  // 4. Read RFID
  readRFID();
  
  Serial.println("序列1执行完成");
}

// A1按钮对应的序列：servo max到min, stepper反转一圈，servo min到max，读取RFID
void executeSequence2() {
  Serial.println("执行序列2...");
  
  // 1. Servo from max to min
  servoMaxToMin();
  
  // 2. Stepper motor reverse rotation with self-check
  stepperRotateReverse();
  rotationCount--; // 减少反向旋转计数
  Serial.print("当前旋转计数: ");
  Serial.println(rotationCount);
  
  // 3. Servo from min to max
  servoMinToMax();
  
  // 4. Read RFID
  readRFID();
  
  Serial.println("序列2执行完成");
}

// A2按钮对应的重置序列：servo max到min, stepper旋转回初始位置，servo min到max
void executeResetSequence() {
  Serial.println("执行重置序列...");
  Serial.print("当前旋转计数: ");
  Serial.println(rotationCount);
  
  // 1. Servo from max to min
  servoMaxToMin();
  
  // 2. 根据当前旋转计数，确定需要正转或反转多少圈回到初始位置
  if (rotationCount > 0) {
    // 如果累计是正向旋转，需要反向旋转相应圈数
    Serial.print("需要反转 ");
    Serial.print(rotationCount);
    Serial.println(" 圈回到初始位置");
    
    for (int i = 0; i < rotationCount; i++) {
      Serial.print("反转第 ");
      Serial.print(i+1);
      Serial.print("/");
      Serial.print(rotationCount);
      Serial.println(" 圈");
      stepperRotateReverse();
    }
  } else if (rotationCount < 0) {
    // 如果累计是反向旋转，需要正向旋转相应圈数
    int absCount = abs(rotationCount);
    Serial.print("需要正转 ");
    Serial.print(absCount);
    Serial.println(" 圈回到初始位置");
    
    for (int i = 0; i < absCount; i++) {
      Serial.print("正转第 ");
      Serial.print(i+1);
      Serial.print("/");
      Serial.print(absCount);
      Serial.println(" 圈");
      stepperRotateForward();
    }
  } else {
    Serial.println("已经在初始位置，无需旋转");
  }
  
  // 重置旋转计数
  rotationCount = 0;
  Serial.println("旋转计数已重置为0");
  
  // 3. Servo from min to max
  servoMinToMax();
  Serial.println("重置序列执行完成");
}

// 舵机从最小位置到最大位置
void servoMinToMax() {
  Serial.println("舵机从最小位置移动到最大位置...");
  for (int a = servomin; a <= servomax; a++) {
    myServo.write(a);
    delay(3);
  }
  delay(300);  // 稍作停留
}

// 舵机从最大位置到最小位置
void servoMaxToMin() {
  Serial.println("舵机从最大位置移动到最小位置...");
  for (int a = servomax; a >= servomin; a--) {
    myServo.write(a);
    delay(3);
  }
  delay(300);  // 稍作停留
}

// 步进电机归零操作
void homeStepperMotor() {
  Serial.println("步进电机归零中...");
  
  // 向反方向转到限位点
  digitalWrite(dirPin, LOW);  // 修改：原来是 HIGH
  while (digitalRead(limitSwitchPin) == LOW) {
    stepOnce(800); // 慢速
  }

  Serial.println("限位开关触发，退出限位区域...");

  // 退出限位区域
  digitalWrite(dirPin, HIGH);  // 修改：原来是 LOW
  for (int i = 0; i < exitSteps; i++) {
    stepOnce(800);
  }

  Serial.println("归零完成");
  delay(500);
  
  // 记录当前电机方向为正转（最后一次动作）
  lastRotationForward = true;
}

// 步进电机正转一圈（带自检）
void stepperRotateForward() {
  Serial.println("步进电机正转一圈...");
  
  digitalWrite(dirPin, HIGH);  // 修改：原来是 LOW
  bool validLimitSwitchHit = false;
  
  // 如果上次是反转，本次是正转，忽略第一次限位开关触发
  bool ignoreLimitSwitch = !lastRotationForward;
  int limitSwitchCount = 0;
  int stepsTaken = 0;  // 记录已走的步数
  
  // 第一阶段：至少走minStepsPerRev步
  while (stepsTaken < minStepsPerRev) {
    stepOnce(stepDelay);
    stepsTaken++;
    
    // 检查限位开关
    if (digitalRead(limitSwitchPin) == HIGH) {
      limitSwitchCount++;
      Serial.print("检测到限位开关触发, 计数: ");
      Serial.println(limitSwitchCount);
      
      // 如果是第一次触发并且需要忽略，则继续
      if (limitSwitchCount == 1 && ignoreLimitSwitch) {
        Serial.println("忽略第一次限位开关触发，继续旋转...");
        // 等待限位开关释放
        while (digitalRead(limitSwitchPin) == HIGH) {
          stepOnce(stepDelay);
          stepsTaken++;
        }
      } else {
        // 第二次触发或者不需要忽略的第一次触发
        // 但仍然继续走完最少步数
        validLimitSwitchHit = true;
      }
    }
  }
  
  Serial.println("已完成最少步数: " + String(stepsTaken));
  
  // 第二阶段：如果还没有遇到有效的限位开关触发，继续走直到触发
  if (!validLimitSwitchHit) {
    Serial.println("继续寻找有效的限位开关触发点...");
    while (!validLimitSwitchHit) {
      stepOnce(stepDelay);
      stepsTaken++;
      
      // 检查限位开关
      if (digitalRead(limitSwitchPin) == HIGH) {
        limitSwitchCount++;
        Serial.print("检测到限位开关触发, 计数: ");
        Serial.println(limitSwitchCount);
        
        // 如果是第一次触发并且需要忽略，则继续
        if (limitSwitchCount == 1 && ignoreLimitSwitch) {
          Serial.println("忽略第一次限位开关触发，继续旋转...");
          // 等待限位开关释放
          while (digitalRead(limitSwitchPin) == HIGH) {
            stepOnce(stepDelay);
            stepsTaken++;
          }
        } else {
          // 第二次触发或者不需要忽略的第一次触发，现在可以停止了
          validLimitSwitchHit = true;
        }
      }
    }
  }

  Serial.println("有效限位开关触发，总步数: " + String(stepsTaken));
  Serial.println("退出限位区域...");

  // 触发后，再走 exitSteps 步退出触发区域
  for (int j = 0; j < exitSteps; j++) {
    stepOnce(stepDelay);
  }
  
  Serial.println("步进电机正转完成");
  delay(500);
  
  // 更新旋转方向记录
  lastRotationForward = true;
}

// 步进电机反转一圈（带自检）
void stepperRotateReverse() {
  Serial.println("步进电机反转一圈...");
  
  digitalWrite(dirPin, LOW);  // 修改：原来是 HIGH
  bool validLimitSwitchHit = false;
  
  // 如果上次是正转，本次是反转，忽略第一次限位开关触发
  bool ignoreLimitSwitch = lastRotationForward;
  int limitSwitchCount = 0;
  int stepsTaken = 0;  // 记录已走的步数
  
  // 第一阶段：至少走minStepsPerRev步
  while (stepsTaken < minStepsPerRev) {
    stepOnce(stepDelay);
    stepsTaken++;
    
    // 检查限位开关
    if (digitalRead(limitSwitchPin) == HIGH) {
      limitSwitchCount++;
      Serial.print("检测到限位开关触发, 计数: ");
      Serial.println(limitSwitchCount);
      
      // 如果是第一次触发并且需要忽略，则继续
      if (limitSwitchCount == 1 && ignoreLimitSwitch) {
        Serial.println("忽略第一次限位开关触发，继续旋转...");
        // 等待限位开关释放
        while (digitalRead(limitSwitchPin) == HIGH) {
          stepOnce(stepDelay);
          stepsTaken++;
        }
      } else {
        // 第二次触发或者不需要忽略的第一次触发
        // 但仍然继续走完最少步数
        validLimitSwitchHit = true;
      }
    }
  }
  
  Serial.println("已完成最少步数: " + String(stepsTaken));
  
  // 第二阶段：如果还没有遇到有效的限位开关触发，继续走直到触发
  if (!validLimitSwitchHit) {
    Serial.println("继续寻找有效的限位开关触发点...");
    while (!validLimitSwitchHit) {
      stepOnce(stepDelay);
      stepsTaken++;
      
      // 检查限位开关
      if (digitalRead(limitSwitchPin) == HIGH) {
        limitSwitchCount++;
        Serial.print("检测到限位开关触发, 计数: ");
        Serial.println(limitSwitchCount);
        
        // 如果是第一次触发并且需要忽略，则继续
        if (limitSwitchCount == 1 && ignoreLimitSwitch) {
          Serial.println("忽略第一次限位开关触发，继续旋转...");
          // 等待限位开关释放
          while (digitalRead(limitSwitchPin) == HIGH) {
            stepOnce(stepDelay);
            stepsTaken++;
          }
        } else {
          // 第二次触发或者不需要忽略的第一次触发，现在可以停止了
          validLimitSwitchHit = true;
        }
      }
    }
  }
  
  Serial.println("有效限位开关触发，总步数: " + String(stepsTaken));
  Serial.println("为避免下次误触，继续反转多走一些步数...");
  
  // 在反转过程中触发限位开关后，还需要再多走一些步数，避免下次正转时立即触发
  // 这个步数要大于 exitSteps，比如取 exitSteps + 10
  for (int j = 0; j < exitSteps + 10; j++) {
    stepOnce(stepDelay);
  }
  
  Serial.println("步进电机反转完成");
  delay(500);
  
  // 更新旋转方向记录
  lastRotationForward = false;
}

// 读取RFID卡片
void readRFID() {
  Serial.println("读取RFID卡片...");
  
  // 设定一个读取超时时间（例如3秒）
  unsigned long startTime = millis();
  bool cardRead = false;
  
  while (millis() - startTime < 3000 && !cardRead) {
    // 检查是否有新卡片
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      // 显示卡片UID
      Serial.print("卡片UID: ");
      for (byte i = 0; i < rfid.uid.size; i++) {
        Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
        Serial.print(rfid.uid.uidByte[i], HEX);
      }
      Serial.println();
      
      // 查找卡片UID对应的按键
      char keyToPress = findKeyForCard(rfid.uid.uidByte);
      
      if (keyToPress != 0) {
        Serial.print("发送按键: ");
        Serial.println(keyToPress);
        Keyboard.press(keyToPress);
        delay(100);
        Keyboard.release(keyToPress);
      } else {
        Serial.println("未找到匹配的按键");
      }
      
      // 记录当前卡片UID
      for (byte i = 0; i < 7; i++) {
        lastUid[i] = rfid.uid.uidByte[i];
      }
      cardPresent = true;
      cardRead = true;  // 标记已读取到卡片，退出循环
      
      // 结束当前通信
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
    }
    
    delay(50);  // 短暂延迟，防止过快读取
  }
  
  if (!cardRead) {
    Serial.println("未读取到RFID卡片，超时");
  }
}

// === 单步封装 ===
void stepOnce(int delayMicros) {
  digitalWrite(stepPin, HIGH);
  delayMicroseconds(delayMicros);
  digitalWrite(stepPin, LOW);
  delayMicroseconds(delayMicros);
}

// 根据卡片UID查找对应按键
char findKeyForCard(byte *uid) {
  int numMappings = sizeof(cardMapping) / sizeof(cardMapping[0]);
  
  for (int i = 0; i < numMappings; i++) {
    bool match = true;
    
    // 检查是否是4字节卡片 (以第5位是否为0作为判断依据)
    bool isCard4Byte = cardMapping[i].uid[4] == 0x00 && cardMapping[i].uid[5] == 0x00 && cardMapping[i].uid[6] == 0x00;
    
    // 新增的4字节卡片 (判断方法是最后3位全为0)
    if (isCard4Byte && cardMapping[i].uid[0] != 0x04) {
      // 只对比前4个字节
      for (int j = 0; j < 4; j++) {
        if (uid[j] != cardMapping[i].uid[j]) {
          match = false;
          break;
        }
      }
    } else {
      // 7字节卡片：对比所有7位
      for (int j = 0; j < 7; j++) {
        if (uid[j] != cardMapping[i].uid[j]) {
          match = false;
          break;
        }
      }
    }
    
    if (match) {
      return cardMapping[i].key;
    }
  }
  
  return 0; // 如果没有找到匹配项，返回0
}