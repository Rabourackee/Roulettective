// 分层推理解谜游戏
// 一个具有动态内容和分层揭示功能的解谜游戏

import OpenAI from 'openai';

// 游戏配置
const CONFIG = {
  apiModel: "gpt-4o",         // 使用的API模型
  maxHistory: 10,             // 最大历史记录数
  minSlidesBeforeReveal: 4,   // 进入揭示阶段前需要的最小卡片数
  insightDuration: 5000       // 洞察标记显示时间（毫秒）
};

// 游戏状态
let gameState = {
  slides: [],                // 卡片类型数组
  content: [],               // 卡片内容数组
  originalContent: [],       // 原始内容（更新前）
  currentIndex: -1,          // 当前卡片索引
  phase: "initial",          // 游戏阶段：initial, investigating, reveal, conclusion
  insightChain: [],          // 洞察链跟踪栈
  insightLevel: 0,           // 当前洞察深度
  modifiedSlides: new Set(), // 已更新卡片的集合
  previousMysteries: [],     // 之前谜题的主题数组（避免重复）
  isLoading: false,          // 加载状态
  correctAnswer: null        // 正确答案（理论阶段）
};

// 初始化OpenAI
let openai;

// DOM元素
const elements = {};

// 检查API密钥是否存在
function checkAPIKey() {
  try {
    // 读取.env文件中的API密钥
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("API密钥未找到。请确保.env文件中包含VITE_OPENAI_API_KEY");
      return false;
    }
    
    console.log("API密钥已找到");
    return true;
  } catch (error) {
    console.error("检查API密钥时出错:", error);
    
    // 尝试使用全局变量作为后备
    if (typeof window.OPENAI_API_KEY !== 'undefined') {
      console.log("使用全局变量中的API密钥");
      return true;
    }
    
    return false;
  }
}

// 初始化游戏
async function setup() {
  try {
    // 缓存DOM元素
    cacheElements();
    
    // 检查API密钥
    if (!checkAPIKey()) {
      elements.connectionStatus.textContent = "API错误";
      elements.connectionStatus.classList.add('error');
      elements.instructionBar.textContent = 
        "API密钥未找到。请检查.env文件中是否包含VITE_OPENAI_API_KEY";
      return;
    }
    
    // 获取API密钥
    let apiKey;
    try {
      apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    } catch (e) {
      // 如果环境变量不可用，尝试使用全局变量
      apiKey = window.OPENAI_API_KEY;
    }
    
    // 初始化OpenAI客户端
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true 
    });
    
    // 附加事件监听器
    attachEventListeners();
    
    // 设置UI
    updateUI();
    
    // 记录成功初始化
    console.log("分层推理解谜游戏初始化成功");
    
  } catch (error) {
    showError(`初始化错误: ${error.message}`);
    console.error("初始化错误:", error);
  }
}

// 缓存DOM元素
function cacheElements() {
  elements.caseCard = document.getElementById('case-card');
  elements.cardContent = document.getElementById('card-content');
  elements.slideIndicator = document.getElementById('slide-indicator');
  elements.instructionBar = document.getElementById('instruction-bar');
  elements.loadingOverlay = document.getElementById('loading-overlay');
  elements.loadingMessage = document.getElementById('loading-message');
  elements.gamePhase = document.getElementById('game-phase');
  elements.connectionStatus = document.getElementById('connection-status');
  elements.revealPanel = document.getElementById('reveal-panel');
  elements.insightBadge = document.getElementById('insight-badge');
  elements.depthLevel = document.getElementById('depth-level');
  elements.slideHistory = document.getElementById('slide-history');
  
  // 控制按钮
  elements.mysteryBtn = document.getElementById('btn-mystery');
  elements.evidenceBtn = document.getElementById('btn-evidence');
  elements.characterBtn = document.getElementById('btn-character');
  elements.locationBtn = document.getElementById('btn-location');
  elements.actionBtn = document.getElementById('btn-action');
  elements.revealBtn = document.getElementById('btn-reveal');
  
  // 导航按钮
  elements.backBtn = document.getElementById('btn-back');
  elements.forwardBtn = document.getElementById('btn-forward');
  elements.returnBtn = document.getElementById('btn-return');
  
  // 理论按钮 - 获取所有带theory-btn类的按钮
  elements.theoryBtns = document.querySelectorAll('.theory-btn');
}

// 附加事件监听器
function attachEventListeners() {
  // 控制按钮
  elements.mysteryBtn.addEventListener('click', () => createMysterySlide());
  elements.evidenceBtn.addEventListener('click', () => createSlide('Evidence'));
  elements.characterBtn.addEventListener('click', () => createSlide('Character'));
  elements.locationBtn.addEventListener('click', () => createSlide('Location'));
  elements.actionBtn.addEventListener('click', () => createSlide('Action'));
  elements.revealBtn.addEventListener('click', () => createSlide('Reveal'));
  
  // 导航按钮
  elements.backBtn.addEventListener('click', navigateBack);
  elements.forwardBtn.addEventListener('click', navigateForward);
  elements.returnBtn.addEventListener('click', navigateReturn);
  
  // 理论按钮
  elements.theoryBtns.forEach(button => {
    button.addEventListener('click', event => {
      const theoryNumber = parseInt(event.target.dataset.theory);
      submitTheory(theoryNumber);
    });
  });
  
  // 键盘导航
  document.addEventListener('keydown', handleKeyPress);
}

// 处理键盘快捷键
function handleKeyPress(event) {
  // 加载中忽略按键
  if (gameState.isLoading) return;
  
  const key = event.key.toLowerCase();
  
  // 根据按键处理
  switch(key) {
    // 卡片类型
    case 'm': createMysterySlide(); break;
    case 'e': createSlide('Evidence'); break;
    case 'c': createSlide('Character'); break;
    case 'l': createSlide('Location'); break;
    case 'a': createSlide('Action'); break;
    case 'r': createSlide('Reveal'); break;
    
    // 导航
    case 'b': navigateBack(); break;
    case 'f': navigateForward(); break;
    case 't': navigateReturn(); break;
    
    // 理论选择
    case '1': case '2': case '3': case '4': case '5':
      if (gameState.phase === 'reveal') {
        submitTheory(parseInt(key));
      }
      break;
  }
}

// 创建一个新的谜题卡片
async function createMysterySlide() {
  // 检查是否已在加载
  if (gameState.isLoading) return;
  
  // 如果已经在游戏中，确认重置
  if (gameState.slides.length > 0) {
    if (!confirm("开始新谜题将重置当前进度。是否继续？")) {
      return;
    }
  }
  
  // 显示加载状态
  setLoading(true, "正在生成新谜题...");
  
  try {
    // 重置游戏状态
    resetGameState();
    
    // 生成系统提示
    const systemPrompt = createMysterySystemPrompt();
    
    // 生成用户提示
    const userPrompt = "生成一个全新的谋杀谜题场景。使用不同寻常的设定、谋杀方法或时代背景，使其区别于典型的谜题故事。以明确陈述核心谜题的句子结尾。";
    
    // 调用API生成谜题
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    
    // 获取谜题内容
    const mysteryContent = response.choices[0].message.content;
    
    // 提取此谜题的标识符（用于避免重复）
    const mysteryIdentifier = extractMysteryIdentifier(mysteryContent);
    gameState.previousMysteries.push(mysteryIdentifier);
    
    // 添加到游戏状态
    gameState.slides.push("Mystery");
    gameState.content.push(mysteryContent);
    gameState.originalContent.push(mysteryContent);
    gameState.currentIndex = 0;
    gameState.phase = "investigating";
    
    // 更新UI
    updateUI();
    updatePhaseIndicator();
    updateSlideHistory();
    
    // 隐藏加载状态
    setLoading(false);
    
  } catch (error) {
    console.error("创建谜题错误:", error);
    showError(`创建谜题错误: ${error.message}`);
    setLoading(false);
  }
}

// 创建谜题生成的系统提示
function createMysterySystemPrompt() {
  let prompt = `你是一位专家解谜作家，负责为互动解谜游戏创建独特的谜题场景。你的任务是创建一个引人入胜且独特的谋杀谜题开场。

谜题指南:
- 创建独特的场景、人物和谋杀场景，使其感觉新鲜且原创
- 包含不寻常但合理的情况或看似不可能的情况
- 设置一个看似无法解决的初始谜题
- 暗示之后会揭示的更深层真相
- 将描述控制在约200字左右
- 以明确陈述需要解决的初始谜题结尾
- 使你的写作具有氛围感、沉浸感和吸引力

你的回答应该纯粹是叙事内容，不要包含对游戏本身的元引用。`;

  // 添加以前的谜题以避免重复
  if (gameState.previousMysteries.length > 0) {
    prompt += `\n\n非常重要：使这个谜题与以下先前的谜题完全不同：${gameState.previousMysteries.join("，")}。使用不同的设定、时代背景、谋杀方法和人物类型。`;
  }

  return prompt;
}

// 从谜题内容中提取标识符
function extractMysteryIdentifier(content) {
  // 获取第一句话或前50个字符
  const firstSentenceMatch = content.match(/^([^.!?]+[.!?])/);
  if (firstSentenceMatch && firstSentenceMatch[1]) {
    return firstSentenceMatch[1].trim();
  }
  return content.substring(0, 50).trim();
}

// 创建指定类型的新卡片
async function createSlide(slideType) {
  // 检查是否已在加载
  if (gameState.isLoading) return;
  
  // 检查是否需要先从Mystery开始
  if (gameState.slides.length === 0) {
    elements.instructionBar.textContent = "您需要先创建一个谜题卡片。按M开始。";
    return;
  }
  
  // 检查是否已经处于结论阶段
  if (gameState.phase === "conclusion") {
    elements.instructionBar.textContent = "此谜题已解决。按M开始新的谜题。";
    return;
  }
  
  // 检查是否位于卡片末尾
  if (gameState.currentIndex < gameState.slides.length - 1) {
    elements.instructionBar.textContent = "在添加新内容前，请导航至末尾。";
    return;
  }
  
  // 显示加载状态
  setLoading(true, `正在生成${slideType}内容...`);
  
  try {
    // 生成系统提示
    const systemPrompt = createSlideSystemPrompt(slideType);
    
    // 准备现有卡片的上下文
    const messages = [{ role: "system", content: systemPrompt }];
    
    // 添加所有先前的卡片作为上下文
    for (let i = 0; i < gameState.slides.length; i++) {
      messages.push(
        { role: "user", content: `${gameState.slides[i]} 卡片:` },
        { role: "assistant", content: gameState.content[i] }
      );
    }
    
    // 添加对此卡片类型的特定请求
    messages.push({ role: "user", content: `为此谜题生成一个${slideType}卡片。` });
    
    // Reveal卡片的特殊处理
    if (slideType === "Reveal") {
      // 确保我们有足够的卡片
      if (gameState.slides.length < CONFIG.minSlidesBeforeReveal) {
        elements.instructionBar.textContent = 
          `在揭示前需要更多调查。至少再添加${CONFIG.minSlidesBeforeReveal - gameState.slides.length}张卡片。`;
        setLoading(false);
        return;
      }
      
      // Reveal卡片的特殊系统提醒
      messages.push({
        role: "system",
        content: "记住要创建正好5个理论，其中4个为真，1个为假。清晰地将它们编号为理论#1、理论#2等。"
      });
      
      // 更新游戏阶段
      gameState.phase = "reveal";
    }
    
    // 调用API生成内容
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    
    // 获取卡片内容
    const slideContent = response.choices[0].message.content;
    
    // 对Reveal卡片，确定哪个理论是假的
    if (slideType === "Reveal") {
      // 询问哪个理论是假的
      const falseTheoryMessages = [
        ...messages,
        { role: "assistant", content: slideContent },
        { role: "user", content: "哪个理论编号包含错误陈述？只回复一个数字1-5。" }
      ];
      
      const falseTheoryResponse = await openai.chat.completions.create({
        model: CONFIG.apiModel,
        messages: falseTheoryMessages
      });
      
      const falseTheoryContent = falseTheoryResponse.choices[0].message.content;
      const falseTheoryNumber = parseInt(falseTheoryContent.match(/\d+/)[0]);
      
      // 存储正确答案
      gameState.correctAnswer = falseTheoryNumber;
      console.log(`理论#${falseTheoryNumber}是错误的`);
    }
    
    // 添加到游戏状态
    gameState.slides.push(slideType);
    gameState.content.push(slideContent);
    gameState.originalContent.push(slideContent);
    gameState.currentIndex = gameState.slides.length - 1;
    
    // 对特定卡片，进入洞察链
    if (slideType === "Evidence" || slideType === "Character" || slideType === "Action") {
      enterInsightChain();
    }
    
    // 更新UI
    updateUI();
    updatePhaseIndicator();
    updateSlideHistory();
    
    // 隐藏加载状态
    setLoading(false);
    
  } catch (error) {
    console.error(`创建${slideType}卡片错误:`, error);
    showError(`创建${slideType}错误: ${error.message}`);
    setLoading(false);
  }
}

// 为不同卡片类型创建系统提示
function createSlideSystemPrompt(slideType) {
  let basePrompt = `你正在为互动谜题调查体验提供支持。玩家通过添加不同类型的卡片来探索谜题。你的回应应简洁、有氛围感，并专注于纯粹的叙事内容。

当前卡片请求: ${slideType}卡片

卡片类型:
- Mystery: 设置谜题的开场场景。
- Evidence: 与案件相关的物理线索。
- Character: 案件中涉及的人物，包括他们的陈述或证词。
- Location: 与案件相关的场景。
- Action: 揭示新信息的调查行动。
- Reveal: 关于发生事件的理论总结。

重要：谜题有玩家将逐步发现的隐藏真相层。包含可能随着更多信息的出现而被不同解释的元素。`;

  // 根据卡片类型添加特定指示
  switch(slideType) {
    case "Evidence":
      return basePrompt + `\n\n对于这个Evidence卡片:
- 揭示一个包含模糊细节的物理线索
- 该证据应有可以被多种方式解释的细节
- 包含微妙的元素，这些元素可能在后面变得更加重要
- 将你的回应控制在1-2段有氛围感的描述内`;
      
    case "Character":
      return basePrompt + `\n\n对于这个Character卡片:
- 介绍一个与案件相关的人物
- 包含他们对事件的陈述或证词
- 添加微妙的不一致或暗示他们可能不完全诚实的提示
- 他们的言行可能暗示隐藏的动机
- 将你的回应控制在1-2段内，专注于人物和他们所说的内容`;
      
    case "Location":
      return basePrompt + `\n\n对于这个Location卡片:
- 描述一个与谜题相关的场景
- 包含可能具有重要性的环境细节
- 一些元素现在可能看起来普通，但稍后可能变得重要
- 空间可能包含关于那里发生事件的微妙线索
- 将你的回应控制在1-2段有氛围感的描述内`;
      
    case "Action":
      return basePrompt + `\n\n对于这个Action卡片:
- 描述侦探采取的调查行动
- 这个行动应该揭示新信息或对现有线索的新视角
- 它可能涉及询问、更仔细地检查证据或测试理论
- 新信息应该为谜题增加复杂性
- 将你的回应控制在1-2段内，专注于行动和它所揭示的内容`;
      
    case "Reveal":
      return basePrompt + `\n\n对于这个Reveal卡片:
1. 生成正好5个解释谜题方面的理论。
2. 使其中4个理论为真，1个为假。
3. 按以下格式呈现你的回应:
   "理论#1: [第一个陈述]
    理论#2: [第二个陈述]
    理论#3: [第三个陈述]
    理论#4: [第四个陈述]
    理论#5: [第五个陈述]
    
    哪个理论是错误的？选择一个数字1-5。"
4. 错误的理论应该是合理的，但包含一个微妙的错误。
5. 每个理论应该是1-2句话，解决谜题的一个关键方面。
6. 记住确切哪个理论是错误的 - 你将在后续中被询问。`;
      
    default:
      return basePrompt;
  }
}

// 进入洞察链
function enterInsightChain() {
  // 仅在尚未处于洞察链中时进入
  if (gameState.insightLevel === 0) {
    gameState.insightLevel = 1;
    gameState.insightChain.push(gameState.currentIndex);
    elements.instructionBar.textContent = 
      "您发现了一条新的洞察路径。添加更多卡片继续探索，或按T处理洞察。";
    updateInsightIndicator();
  }
}

// 更新洞察深度指示器
function updateInsightIndicator() {
  elements.depthLevel.textContent = gameState.insightLevel;
  
  // 如果在洞察链中，添加可视类
  if (gameState.insightLevel > 0) {
    elements.depthLevel.parentElement.classList.add('active');
  } else {
    elements.depthLevel.parentElement.classList.remove('active');
  }
}

// 后退导航
function navigateBack() {
  if (gameState.isLoading) return;
  
  if (gameState.slides.length === 0) {
    elements.instructionBar.textContent = "还没有卡片。按M开始一个谜题。";
    return;
  }
  
  if (gameState.currentIndex > 0) {
    gameState.currentIndex--;
    updateUI();
    elements.cardContent.classList.add('transition');
    setTimeout(() => {
      elements.cardContent.classList.remove('transition');
    }, 400);
  } else {
    elements.instructionBar.textContent = "已经在第一张卡片。";
  }
}

// 前进导航
function navigateForward() {
  if (gameState.isLoading) return;
  
  if (gameState.slides.length === 0) {
    elements.instructionBar.textContent = "还没有卡片。按M开始一个谜题。";
    return;
  }
  
  if (gameState.currentIndex < gameState.slides.length - 1) {
    gameState.currentIndex++;
    updateUI();
    elements.cardContent.classList.add('transition');
    setTimeout(() => {
      elements.cardContent.classList.remove('transition');
    }, 400);
  } else {
    elements.instructionBar.textContent = "已经在最后一张卡片。添加更多内容继续。";
  }
}

// 返回导航（从洞察链）
async function navigateReturn() {
  if (gameState.isLoading) return;
  
  // 检查是否在洞察链中
  if (gameState.insightLevel <= 0) {
    elements.instructionBar.textContent = "不在洞察链中。";
    return;
  }
  
  // 显示加载状态
  setLoading(true, "处理洞察并更新早期内容...");
  
  try {
    // 获取要返回的索引
    const returnIndex = gameState.insightChain.pop();
    
    // 减少洞察级别
    gameState.insightLevel--;
    
    // 如果完全退出链，更新早期卡片
    if (gameState.insightLevel === 0) {
      await updateSlidesWithNewInsights();
    }
    
    // 转到返回索引
    gameState.currentIndex = returnIndex;
    
    // 更新UI
    updateUI();
    updateInsightIndicator();
    updateSlideHistory();
    
    // 隐藏加载
    setLoading(false);
    
  } catch (error) {
    console.error("从洞察链返回错误:", error);
    showError(`处理洞察错误: ${error.message}`);
    setLoading(false);
  }
}

// 完成洞察链后更新卡片
async function updateSlidesWithNewInsights() {
  // 识别应该更新的卡片
  const slidesToUpdate = [];
  
  // 根据发现找出应该更新的卡片
  for (let i = 0; i < gameState.slides.length - 1; i++) {
    // 跳过已更新的卡片
    if (gameState.modifiedSlides.has(i)) {
      continue;
    }
    
    // Character卡片受Evidence或Action影响
    if (gameState.slides[i] === "Character") {
      // 寻找后续的Evidence或Action卡片
      let hasRelevantLaterSlide = false;
      for (let j = i + 1; j < gameState.slides.length; j++) {
        if (gameState.slides[j] === "Evidence" || gameState.slides[j] === "Action") {
          hasRelevantLaterSlide = true;
          break;
        }
      }
      
      if (hasRelevantLaterSlide) {
        slidesToUpdate.push(i);
      }
    }
    
    // Evidence卡片受Character或Action影响
    if (gameState.slides[i] === "Evidence") {
      // 寻找后续的Character或Action卡片
      let hasRelevantLaterSlide = false;
      for (let j = i + 1; j < gameState.slides.length; j++) {
        if (gameState.slides[j] === "Character" || gameState.slides[j] === "Action") {
          hasRelevantLaterSlide = true;
          break;
        }
      }
      
      if (hasRelevantLaterSlide) {
        slidesToUpdate.push(i);
      }
    }
    
    // Location卡片受任何后续卡片影响
    if (gameState.slides[i] === "Location") {
      // 检查是否有任何后续卡片
      if (i < gameState.slides.length - 1) {
        slidesToUpdate.push(i);
      }
    }
  }
  
  // 如果没有要更新的卡片则跳过
  if (slidesToUpdate.length === 0) {
    elements.instructionBar.textContent = "没有可以用新洞察更新的卡片。";
    return;
  }
  
  // 处理时更新指示
  elements.instructionBar.textContent = `正在用新洞察更新${slidesToUpdate.length}张卡片...`;
  
  // 更新每张卡片
  for (let i = 0; i < slidesToUpdate.length; i++) {
    const index = slidesToUpdate[i];
    
    // 更新加载消息显示进度
    elements.loadingMessage.textContent = 
      `正在更新${gameState.slides[index]}卡片（${i + 1}/${slidesToUpdate.length}）...`;
    
    // 更新卡片
    await updateSlideWithNewInsights(index);
    
    // 标记为已修改
    gameState.modifiedSlides.add(index);
  }
  
  // 显示完成
  elements.instructionBar.textContent = 
    `已用更深层洞察更新${slidesToUpdate.length}张卡片。`;
  
  // 如果当前查看的是已更新的卡片，刷新内容
  if (gameState.modifiedSlides.has(gameState.currentIndex)) {
    showInsightBadge();
  }
}

// 用新洞察更新特定卡片
async function updateSlideWithNewInsights(slideIndex) {
  try {
    // 基于卡片类型创建系统提示
    const slideType = gameState.slides[slideIndex];
    const systemPrompt = createUpdateSystemPrompt(slideType);
    
    // 创建消息数组
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    
    // 添加原始内容
    messages.push({ 
      role: "user", 
      content: `原始${slideType}内容: ${gameState.originalContent[slideIndex]}`
    });
    
    // 添加此卡片之后发现的所有内容
    let laterDiscoveries = "后续发现:";
    for (let i = slideIndex + 1; i < gameState.slides.length; i++) {
      laterDiscoveries += `\n\n${gameState.slides[i]}卡片: ${gameState.content[i]}`;
    }
    
    messages.push({ role: "user", content: laterDiscoveries });
    
    // 请求更新
    messages.push({ 
      role: "user", 
      content: `请基于这些后续发现来更新${slideType}卡片，揭示更深层的洞察。`
    });
    
    // 调用API
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    
    // 获取更新内容
    const updatedContent = response.choices[0].message.content;
    
    // 更新游戏状态
    gameState.content[slideIndex] = updatedContent;
    
  } catch (error) {
    console.error(`更新卡片${slideIndex}错误:`, error);
    // 失败时回退到原始内容
    gameState.content[slideIndex] = gameState.originalContent[slideIndex];
  }
}

// 创建更新卡片的系统提示
function createUpdateSystemPrompt(slideType) {
  let basePrompt = `你正在更新互动谜题游戏中的卡片，以揭示基于新发现的更深层洞察。玩家已经发现了新信息，让原始内容呈现出新的视角。

你的任务是重写${slideType}卡片内容，揭示更深层的真相。

指南:
- 以"进一步调查后..."或类似短语开始，表明这是新的洞察
- 揭示更深层的真相、矛盾或对原始信息的新解释
- 不要完全否定原始内容，而是添加复杂性和细微差别
- 保持与原始内容大致相同的长度
- 专注于纯叙事内容
- 使更深层的真相感觉像是改变了玩家对谜题理解的启示`;

  // 根据卡片类型添加特定指示
  switch(slideType) {
    case "Character":
      return basePrompt + `\n\n对于这个Character卡片:
- 考虑揭示他们证词中的矛盾
- 展示他们的动机可能比最初呈现的更复杂
- 或许他们知道的比最初承认的更多
- 添加欺骗或暗藏动机的微妙迹象
- 不要完全揭穿他们，而是为他们的角色添加层次`;
      
    case "Evidence":
      return basePrompt + `\n\n对于这个Evidence卡片:
- 揭示最初未被注意到的证据新细节
- 展示与其他发现的联系，这些联系之前并不明显
- 证据可能被误解或被篡改
- 之前看似不重要的细节现在可能有了新的意义
- 考虑揭示一个改变证据意义的隐藏方面`;
      
    case "Location":
      return basePrompt + `\n\n对于这个Location卡片:
- 揭示之前未被注意到的位置细节
- 空间布局可能以之前未理解的方式具有重要性
- 该位置可能被用于与假设不同的目的
- 微妙的痕迹或特征可能表明那里发生过重要事件
- 这个位置与其他位置之间的关系可能很重要`;
      
    default:
      return basePrompt;
  }
}

// 提交理论答案
async function submitTheory(theoryNumber) {
  if (gameState.isLoading) return;
  if (gameState.phase !== "reveal") return;
  
  // 显示加载
  setLoading(true, "基于您的理论选择生成结论...");
  
  try {
    // 检查是否正确
    const isCorrect = (theoryNumber === gameState.correctAnswer);
    
    // 为结论创建消息
    const messages = [
      {
        role: "system",
        content: `基于玩家是否正确识别出错误理论来生成谜题的结论。

${isCorrect ? 
  "他们正确识别了错误理论。提供一个全面而令人满意的解决方案，解释调查过程中发现的所有线索和矛盾。" : 
  `他们错误地认为理论#${theoryNumber}是错误的，而实际上理论#${gameState.correctAnswer}才是错误的。提供一个听起来合理但缺乏关键洞察的有缺陷结论。`}

用戏剧性、有氛围感的风格写作，将谜题清晰地带到结尾。解释所有关键元素（角色、证据、位置）如何在解决方案中结合在一起。`
      }
    ];
    
    // 添加所有卡片历史
    for (let i = 0; i < gameState.slides.length; i++) {
      messages.push(
        { role: "user", content: `${gameState.slides[i]}卡片:` },
        { role: "assistant", content: gameState.content[i] }
      );
    }
    
    // 添加理论选择
    messages.push({ 
      role: "user", 
      content: isCorrect ? 
        `我认为理论#${theoryNumber}是错误的。` : 
        `我认为理论#${theoryNumber}是错误的（但实际上理论#${gameState.correctAnswer}才是错误的）。`
    });
    
    // 调用API获取结论
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    
    // 获取结论
    const conclusion = response.choices[0].message.content;
    
    // 添加到游戏状态
    gameState.slides.push("Conclusion");
    gameState.content.push(conclusion);
    gameState.originalContent.push(conclusion);
    gameState.currentIndex = gameState.slides.length - 1;
    gameState.phase = "conclusion";
    
    // 更新UI
    updateUI();
    updatePhaseIndicator();
    updateSlideHistory();
    
    // 隐藏理论面板
    elements.revealPanel.classList.remove('active');
    
    // 隐藏加载
    setLoading(false);
    
  } catch (error) {
    console.error("提交理论错误:", error);
    showError(`生成结论错误: ${error.message}`);
    setLoading(false);
  }
}

// 临时显示洞察标记
function showInsightBadge() {
  elements.insightBadge.classList.add('visible');
  setTimeout(() => {
    elements.insightBadge.classList.remove('visible');
  }, CONFIG.insightDuration);
}

// 设置加载状态
function setLoading(isLoading, message = "处理中...") {
  gameState.isLoading = isLoading;
  
  if (isLoading) {
    elements.loadingOverlay.classList.add('active');
    elements.loadingMessage.textContent = message;
  } else {
    elements.loadingOverlay.classList.remove('active');
  }
}

// 显示错误消息
function showError(message) {
  elements.connectionStatus.textContent = "错误";
  elements.connectionStatus.classList.add('error');
  elements.instructionBar.textContent = message;
  
  // 记录到控制台
  console.error(message);
  
  // 延迟后重置错误状态
  setTimeout(() => {
    elements.connectionStatus.textContent = "API就绪";
    elements.connectionStatus.classList.remove('error');
  }, 5000);
}

// 基于当前游戏状态更新UI
function updateUI() {
  // 更新卡片内容
  if (gameState.currentIndex >= 0 && gameState.currentIndex < gameState.content.length) {
    // 处理Reveal卡片的特殊格式
    if (gameState.slides[gameState.currentIndex] === "Reveal") {
      // 格式化理论
      const content = gameState.content[gameState.currentIndex];
      let formattedContent = '';
      
      // 按行分割
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.trim().startsWith('理论#') || line.trim().startsWith('Theory #')) {
          formattedContent += `<div class="theory-item">${line}</div>`;
        } else {
          formattedContent += `<p>${line}</p>`;
        }
      }
      
      elements.cardContent.innerHTML = formattedContent;
      elements.revealPanel.classList.add('active');
    } else {
      // 普通卡片
      elements.revealPanel.classList.remove('active');
      
      // 检查此卡片是否已更新
      if (gameState.modifiedSlides.has(gameState.currentIndex)) {
        // 使用洞察高亮格式化
        const content = gameState.content[gameState.currentIndex];
        
        // 为更新内容添加特殊类
        elements.cardContent.className = "card-content updated";
        
        // 如果内容以"进一步调查"或类似内容开头，包装在洞察div中
        if (/^进一步调查|^仔细查看|^新的洞察|^重新考虑/i.test(content)) {
          const firstParagraphEnd = content.indexOf('\n\n');
          if (firstParagraphEnd > 0) {
            const firstParagraph = content.substring(0, firstParagraphEnd);
            const restContent = content.substring(firstParagraphEnd);
            elements.cardContent.innerHTML = `<div class="insight-highlight">${firstParagraph}</div>${restContent}`;
          } else {
            elements.cardContent.textContent = content;
          }
        } else {
          elements.cardContent.textContent = content;
        }
      } else {
        // 常规未更新内容
        elements.cardContent.className = "card-content";
        elements.cardContent.textContent = gameState.content[gameState.currentIndex];
      }
    }
    
    // 更新卡片指示器
    elements.slideIndicator.textContent = 
      `${gameState.slides[gameState.currentIndex]} ${gameState.currentIndex + 1}/${gameState.slides.length}`;
    
    // 如需要添加已更新指示器
    if (gameState.modifiedSlides.has(gameState.currentIndex)) {
      elements.slideIndicator.textContent += " ★";
    }
    
  } else {
    // 尚无卡片
    elements.cardContent.textContent = "欢迎使用分层推理解谜游戏。按M键开始一个新的调查。";
    elements.slideIndicator.textContent = "欢迎";
    elements.revealPanel.classList.remove('active');
  }
  
  // 基于游戏阶段更新指示栏
  updateInstructionBar();
  
  // 更新洞察指示器
  updateInsightIndicator();
}

// 基于当前状态更新指示栏
function updateInstructionBar() {
  // 加载中跳过
  if (gameState.isLoading) return;
  
  switch(gameState.phase) {
    case "initial":
      elements.instructionBar.textContent = "按M键开始一个新的谜题调查。";
      break;
      
    case "investigating":
      if (gameState.insightLevel > 0) {
        elements.instructionBar.textContent = 
          `处于洞察链中（级别${gameState.insightLevel}）。按T键处理或继续探索。`;
      } else if (gameState.modifiedSlides.has(gameState.currentIndex)) {
        elements.instructionBar.textContent = "此内容已用新洞察更新。";
      } else if (gameState.slides.length < CONFIG.minSlidesBeforeReveal) {
        elements.instructionBar.textContent = 
          `添加更多卡片(E/C/L/A)进行调查。揭示前还需${CONFIG.minSlidesBeforeReveal - gameState.slides.length}张卡片。`;
      } else {
        elements.instructionBar.textContent = 
          "添加卡片进行调查(E/C/L/A)。用F/B导航。准备好时按R揭示。";
      }
      break;
      
    case "reveal":
      elements.instructionBar.textContent = "哪个理论是错误的？选择一个理论编号(1-5)。";
      break;
      
    case "conclusion":
      elements.instructionBar.textContent = "谜题已解决。按M键开始一个新的调查。";
      break;
  }
}

// 更新阶段指示器
function updatePhaseIndicator() {
  let phaseText = "";
  
  switch(gameState.phase) {
    case "initial":
      phaseText = "阶段: 等待新谜题";
      break;
    case "investigating":
      phaseText = "阶段: 主动调查";
      break;
    case "reveal":
      phaseText = "阶段: 理论评估";
      break;
    case "conclusion":
      phaseText = "阶段: 案件结束";
      break;
  }
  
  elements.gamePhase.textContent = phaseText;
}

// 更新卡片历史显示
function updateSlideHistory() {
  // 清除当前历史
  elements.slideHistory.innerHTML = "";
  
  // 添加每张卡片
  for (let i = 0; i < gameState.slides.length; i++) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.textContent = `${i + 1}: ${gameState.slides[i]}`;
    
    // 当前卡片添加active类
    if (i === gameState.currentIndex) {
      historyItem.classList.add('active');
    }
    
    // 已修改卡片添加updated类
    if (gameState.modifiedSlides.has(i)) {
      historyItem.classList.add('updated');
    }
    
    // 添加点击事件导航
    historyItem.addEventListener('click', () => {
      if (!gameState.isLoading) {
        gameState.currentIndex = i;
        updateUI();
      }
    });
    
    // 添加到历史
    elements.slideHistory.appendChild(historyItem);
  }
}

// 重置游戏状态
function resetGameState() {
  // 保留先前的谜题以确保唯一性
  const prevMysteries = [...gameState.previousMysteries];
  
  // 重置状态
  gameState = {
    slides: [],
    content: [],
    originalContent: [],
    currentIndex: -1,
    phase: "initial",
    insightChain: [],
    insightLevel: 0,
    modifiedSlides: new Set(),
    previousMysteries: prevMysteries,
    isLoading: false,
    correctAnswer: null
  };
  
  // 重置UI元素
  elements.revealPanel.classList.remove('active');
  elements.cardContent.className = "card-content";
  elements.insightBadge.classList.remove('visible');
  elements.slideHistory.innerHTML = "";
  updatePhaseIndicator();
}

// 添加对全局变量API密钥的支持（如果需要）
window.OPENAI_API_KEY = ""; // 如果不使用.env，可以在这里直接设置

// 当DOM加载完成时初始化游戏
window.setup = setup;
document.addEventListener('DOMContentLoaded', setup);