// Layered Reasoning Mystery Game
// A dynamic mystery game with layered reveal functionality

import OpenAI from 'openai';

// Game configuration
const CONFIG = {
  apiModel: "gpt-4o",          // API model to use
  maxHistory: 10,              // Maximum history records
  minSlidesBeforeReveal: 4,    // Minimum cards needed before reveal phase
  insightDuration: 5000,       // Insight badge display time (milliseconds)
  // 添加每种卡片类型的最大数量限制
  maxCardCounts: {
    Character: 5,              // 人物卡最大数量
    Evidence: 6,               // 证据卡最大数量
    Location: 4,               // 地点卡最大数量
    Action: 6                  // 行动卡最大数量
  },
  // 添加关联触发概率配置
  associationThreshold: 0.75,  // 关联触发阈值，高于此值才触发关联
  maxAssociationsPerGame: 3,   // 每个游戏最多触发关联的次数
  // 添加DALL-E配置
  imageStyle: "vintage film noir style, black and white, criminal scene, dramatic lighting, high contrast, grainy texture, cinematic composition", // DALL-E图片风格
  imageSize: "1024x1024",      // 图片尺寸
  // 添加音乐配置
  musicVolume: 0.5            // 音乐音量
};

// Game state
let gameState = {
  slides: [],                // Array of slide types
  content: [],               // Array of slide contents
  originalContent: [],       // Original content (before updates)
  currentIndex: -1,          // Current slide index
  phase: "initial",          // Game phase: initial, investigating, reveal, conclusion
  insightChain: [],          // Insight chain tracking stack
  insightLevel: 0,           // Current insight depth
  modifiedSlides: new Set(), // Set of updated slides
  previousMysteries: [],     // Array of previous mystery themes (to avoid repetition)
  isLoading: false,          // Loading state
  correctAnswer: null,       // Correct answer (for theory phase)
  slideCounts: {             // Counts of each slide type
    Character: 0,
    Evidence: 0,
    Location: 0,
    Action: 0
  },
  // 添加关联机制状态
  associationCount: 0,       // 当前已触发关联次数
  associationTargets: [],    // 存储强关联对象 [{sourceIndex, targetIndex, reason}]
  // 添加图片状态
  images: [],                // 存储每张幻灯片的图片URL
  isGeneratingImage: false,  // 图片生成状态
  pendingAssociationIndex: undefined,
  // 添加音乐状态
  isMusicPlaying: false,     // 音乐播放状态
  // ===== MODIFIED: intro page index =====
  introPageIndex: null,      // null for normal game, 0/1/2 for intro pages
  // ===== NEW: standby page flag =====
  isStandbyPage: false       // Flag to indicate if we're on the standby page
};

// 添加一个特殊导航状态管理
let navigationState = {
  introPages: 3,    // intro有3页
  introVisited: false,  // 是否已访问过intro
  gameStarted: false,   // 游戏是否已开始
  standbyActive: true,   // 是否已激活待机页面
  ignoreNextSlideRequest: false  // 是否忽略下一次slide请求
};

// Initialize OpenAI
let openai;

// DOM elements
const elements = {};

// 音乐控制函数
function playBackgroundMusic() {
  const bgm = document.getElementById('bgm');
  if (bgm) {
    bgm.volume = CONFIG.musicVolume;
    bgm.play().catch(error => {
      console.error("Error playing background music:", error);
    });
    gameState.isMusicPlaying = true;
  }
}

// 播放待机页面音乐
function playStandbyMusic() {
  const standbyBgm = document.getElementById('standby-bgm');
  if (standbyBgm) {
    standbyBgm.volume = CONFIG.musicVolume;
    standbyBgm.play().catch(error => {
      console.error("Error playing standby music:", error);
    });
  }
}

// 停止待机页面音乐
function stopStandbyMusic() {
  const standbyBgm = document.getElementById('standby-bgm');
  if (standbyBgm) {
    standbyBgm.pause();
    standbyBgm.currentTime = 0;
  }
}

function stopBackgroundMusic() {
  const bgm = document.getElementById('bgm');
  if (bgm) {
    bgm.pause();
    bgm.currentTime = 0;
    gameState.isMusicPlaying = false;
  }
}

// Check if API key exists
function checkAPIKey() {
  try {
    // Read API key from .env file
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("API key not found. Make sure VITE_OPENAI_API_KEY is in your .env file");
      return false;
    }
    
    console.log("API key found");
    return true;
  } catch (error) {
    console.error("Error checking API key:", error);
    
    // Try using global variable as fallback
    if (typeof window.OPENAI_API_KEY !== 'undefined') {
      console.log("Using API key from global variable");
      return true;
    }
    
    return false;
  }
}

// Initialize game
async function setup() {
  try {
    console.log("Setup started");
    
    // 初始化导航状态
    navigationState = {
      introPages: 3,
      introVisited: false,
      gameStarted: false,
      standbyActive: true,
      ignoreNextSlideRequest: false
    };
    
    // Cache DOM elements
    cacheElements();
    
    // Check API key
    if (!checkAPIKey()) {
      elements.connectionStatus.textContent = "API Error";
      elements.connectionStatus.classList.add('error');
      elements.instructionBar.textContent = 
        "API key not found. Please check if VITE_OPENAI_API_KEY is in your .env file";
      return;
    }
    
    // Get API key
    let apiKey;
    try {
      apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    } catch (e) {
      // If environment variable is not available, try global variable
      apiKey = window.OPENAI_API_KEY;
    }
    
    // Initialize OpenAI client
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true 
    });
    
    // Attach event listeners
    attachEventListeners();
    
    // 直接进入待机页面
    gameState.isStandbyPage = true;
    playStandbyMusic();
    
    // Set up UI
    updateUI();
    
    // Log successful initialization
    console.log("Layered Reasoning Mystery Game initialized successfully");
    
  } catch (error) {
    showError(`Initialization Error: ${error.message}`);
    console.error("Initialization Error:", error);
  }
}

// Cache DOM elements
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
  elements.cardImage = document.getElementById('card-image');
  elements.insightLight = document.getElementById('insight-light');
  // Control buttons
  elements.mysteryBtn = document.getElementById('btn-mystery');
  elements.evidenceBtn = document.getElementById('btn-evidence');
  elements.characterBtn = document.getElementById('btn-character');
  elements.locationBtn = document.getElementById('btn-location');
  elements.actionBtn = document.getElementById('btn-action');
  elements.revealBtn = document.getElementById('btn-reveal');
  elements.restartBtn = document.getElementById('btn-restart');
  // Navigation buttons
  elements.backBtn = document.getElementById('btn-back');
  elements.forwardBtn = document.getElementById('btn-forward');
  elements.returnBtn = document.getElementById('btn-return');
  // Theory buttons - get all buttons with theory-btn class
  elements.theoryBtns = document.querySelectorAll('.theory-btn');
  // 只在元素存在时绑定事件
  if (elements.backBtn) elements.backBtn.addEventListener('click', async () => { await navigateBack(); });
  if (elements.forwardBtn) elements.forwardBtn.addEventListener('click', async () => { await navigateForward(); });
}

// Attach event listeners
function attachEventListeners() {
  // Control buttons
  if (elements.mysteryBtn) elements.mysteryBtn.addEventListener('click', () => createMysterySlide());
  if (elements.evidenceBtn) elements.evidenceBtn.addEventListener('click', () => createSlide('Evidence'));
  if (elements.characterBtn) elements.characterBtn.addEventListener('click', () => createSlide('Character'));
  if (elements.locationBtn) elements.locationBtn.addEventListener('click', () => createSlide('Location'));
  if (elements.actionBtn) elements.actionBtn.addEventListener('click', () => createSlide('Action'));
  if (elements.revealBtn) elements.revealBtn.addEventListener('click', () => createSlide('Reveal'));
  if (elements.restartBtn) elements.restartBtn.addEventListener('click', () => restartGame());
  
  // Navigation buttons
  if (elements.returnBtn) elements.returnBtn.addEventListener('click', navigateReturn);
  
  // Theory buttons
  if (elements.theoryBtns && elements.theoryBtns.length > 0) {
    elements.theoryBtns.forEach(button => {
      button.addEventListener('click', event => {
        const theoryNumber = parseInt(event.target.dataset.theory);
        submitTheory(theoryNumber);
      });
    });
  }
  
  // Keyboard navigation
  document.addEventListener('keydown', handleKeyPress);
}

// Handle keyboard shortcuts
function handleKeyPress(event) {
  if (gameState.isLoading) return;
  const key = event.key.toLowerCase();
  
  console.log(`Key pressed: ${key}, introPageIndex: ${gameState.introPageIndex}, isStandbyPage: ${gameState.isStandbyPage}`);
  
  // 如果在待机页面
  if (gameState.isStandbyPage) {
    // 在待机页面按F键直接开始新游戏
    if (key === 'f') {
      gameState.isStandbyPage = false;
      stopStandbyMusic();
      gameState.introPageIndex = null;
      updateUI();
      createMysterySlide();
      return;
    }
    // 在待机页面按B键可以查看intro
    if (key === 'b') {
      gameState.isStandbyPage = false;
      // 不再停止待机音乐，因为intro页面也使用相同的音乐
      gameState.introPageIndex = 0; // 跳转到intro的第一页
      updateUI();
      return;
    }
    return;
  }
  
  // If in intro mode
  if (gameState.introPageIndex !== null) {
    // 在intro中处理R键，跳转回待机页面
    if (key === 'r') {
      gameState.isStandbyPage = true;
      playStandbyMusic();
      gameState.introPageIndex = null;
      navigationState.standbyActive = true;
      updateUI();
      return;
    }
    
    if (key === 'b') { 
      // 在intro中，按B键是进入下一页，而不是返回上一页
      if (gameState.introPageIndex < 2) {
        gameState.introPageIndex++;
        updateUI();
      }
      return; 
    }
    if (key === 'f') { 
      // 在intro中，按F键是返回上一页，如果已经是第一页，则返回待机页面
      if (gameState.introPageIndex > 0) {
        gameState.introPageIndex--;
        updateUI();
      } else {
        // 如果是第一页，返回待机页面
        gameState.isStandbyPage = true;
        playStandbyMusic();
        gameState.introPageIndex = null;
        navigationState.standbyActive = true;
        updateUI();
      }
      return; 
    }
    return;
  }
  
  // Handle based on key
  switch(key) {
    // Card types
    case 'e': createSlide('Evidence'); break;
    case 'c': createSlide('Character'); break;
    case 'l': createSlide('Location'); break;
    case 'a': createSlide('Action'); break;
    case 'v': createSlide('Reveal'); break;
    
    // Navigation
    case 'b': navigateBack(); break;
    case 'f': navigateForward(); break;
    case 't': navigateReturn(); break;
    
    // Restart game
    case 'r': restartGame(); break;
    
    // Theory selection
    case '1': case '2': case '3': case '4': case '5':
      if (gameState.phase === 'reveal') {
        submitTheory(parseInt(key));
      }
      break;
  }
}

// Create a new mystery card
async function createMysterySlide() {
  // Check if already loading
  if (gameState.isLoading) return;
  
  console.log(`createMysterySlide start, introPageIndex: ${gameState.introPageIndex}, isStandbyPage: ${gameState.isStandbyPage}`);
  
  // 如果在待机页面，关闭待机页面
  if (gameState.isStandbyPage) {
    gameState.isStandbyPage = false;
    stopStandbyMusic();
  }
  
  // If already in a game, confirm reset
  if (gameState.slides.length > 0) {
    if (!confirm("Starting a new mystery will reset your current progress. Continue?")) {
      return;
    }
  }
  
  // Show loading state
  setLoading(true, "Opening New Case File");
  
  try {
    // Reset game state
    resetGameState();
    console.log(`After resetGameState, introPageIndex: ${gameState.introPageIndex}`);
    
    // 确保introPageIndex为null，这样不会回到介绍页面
    gameState.introPageIndex = null;
    // 标记游戏已开始
    navigationState.gameStarted = true;
    console.log(`After explicit set, introPageIndex: ${gameState.introPageIndex}`);
    
    // 开始播放背景音乐
    playBackgroundMusic();
    
    // Generate system prompt
    const systemPrompt = createMysterySystemPrompt();
    
    // Generate user prompt
    const userPrompt = "Create a short, clear description of a murder scene. Focus only on describing what is found at the scene - the victim, the location, and any notable details. Do not include any suspects or characters. End with a clear statement of what needs to be solved.";
    
    // Call API to generate mystery
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    
    // Get mystery content
    const mysteryContent = response.choices[0].message.content;
    
    // Extract this mystery's identifier (to avoid repetition)
    const mysteryIdentifier = extractMysteryIdentifier(mysteryContent);
    gameState.previousMysteries.push(mysteryIdentifier);
    
    // Add to game state
    gameState.slides.push("Mystery");
    gameState.content.push(mysteryContent);
    gameState.originalContent.push(mysteryContent);
    gameState.currentIndex = 0;
    gameState.phase = "investigating";
    
    // 生成谜题图片
    await generateImage(mysteryContent, gameState.currentIndex);
    
    console.log(`Before updateUI, introPageIndex: ${gameState.introPageIndex}`);
    
    // Update UI
    updateUI();
    updatePhaseIndicator();
    updateSlideHistory();
    
    console.log(`After updateUI, introPageIndex: ${gameState.introPageIndex}`);
    
    // Hide loading state
    setLoading(false);
    
  } catch (error) {
    console.error("Create mystery error:", error);
    showError(`Create mystery error: ${error.message}`);
    setLoading(false);
  }
}

// Create mystery generation system prompt
function createMysterySystemPrompt() {
  let prompt = `You are a mystery game writer. Your task is to create a short, logical, and solvable crime scene description for a mystery game.
Guidelines:
- There must be exactly one deceased person (the victim) in the scene, and it must be clear that this is a crime (not an accident or natural death).
- Write exactly 4 sentences.
- The first sentence must clearly state that [NAME or ROLE] was found dead at [LOCATION], and that it is a crime.
- The next three sentences visually describe the environment, the victim, and any notable details about the scene (do NOT reveal any evidence or clue, just describe the environment or the victim).
- The scene must be solvable: the details should provide a foundation for logical deduction in later investigation.
- Do NOT include any suspects, characters, or potential perpetrators.
- Each sentence should be direct, visual, and simple.
- Avoid any sensitive or violent words (like blood, murder, weapon, dead, kill, stab, wound, corpse, body, death, suicide, hanged, strangled, gun, knife, shoot, shot, stabbed, killed, victim, crime, etc).
- Do not include any meta information, instructions, or additional content.`;

  if (gameState.previousMysteries.length > 0) {
    prompt += `\n\nAvoid these previous themes: ${gameState.previousMysteries.join(", ")}`;
  }

  return prompt;
}

// Extract identifier from mystery content
function extractMysteryIdentifier(content) {
  // Get first sentence or first 50 characters
  const firstSentenceMatch = content.match(/^([^.!?]+[.!?])/);
  if (firstSentenceMatch && firstSentenceMatch[1]) {
    return firstSentenceMatch[1].trim();
  }
  return content.substring(0, 50).trim();
}

// Create a new slide of specified type
async function createSlide(slideType) {
  // Check if already loading
  if (gameState.isLoading) return;
  
  // 检查是否需要忽略本次slide请求
  if (navigationState.ignoreNextSlideRequest) {
    navigationState.ignoreNextSlideRequest = false; // 重置标记
    elements.instructionBar.textContent = "下一张幻灯片即将生成，请再次按下对应按键。";
    return;
  }
  
  // Check if need to start with Mystery first
  if (gameState.slides.length === 0) {
    elements.instructionBar.textContent = "You need to create a Mystery card first. Press M to start.";
    return;
  }
  
  // Check if already in conclusion phase
  if (gameState.phase === "conclusion") {
    elements.instructionBar.textContent = "This mystery is solved. Press M to start a new mystery.";
    return;
  }
  
  // Check if at end of cards
  if (gameState.currentIndex < gameState.slides.length - 1) {
    elements.instructionBar.textContent = "Navigate to the end before adding new content.";
    return;
  }
  
  // 检查每种卡片类型的限制
  if (slideType !== "Reveal" && slideType !== "Mystery") {
    // 检查特定类型的卡片是否已达到最大数量
    if (gameState.slideCounts[slideType] >= CONFIG.maxCardCounts[slideType]) {
      elements.instructionBar.textContent = `已达到${slideType}卡的最大数量(${CONFIG.maxCardCounts[slideType]}张)，请尝试其他类型的卡片。`;
      return;
    }
    
    // 更新卡片计数
    gameState.slideCounts[slideType]++;
  }
  
  // Show loading state
  let loadingMessage;
  switch(slideType) {
    case "Evidence":
      loadingMessage = "Retrieve Files of Evidence from the Archive";
      break;
    case "Character":
      loadingMessage = "Summoning Witness for Interview";
      break;
    case "Location":
      loadingMessage = "Analyzing Crime Scene Location";
      break;
    case "Action":
      loadingMessage = "Executing Detective Procedure";
      break;
    case "Reveal":
      loadingMessage = "Assembling Case Theories";
      break;
    default:
      loadingMessage = `Generating ${slideType} content...`;
  }
  setLoading(true, loadingMessage);
  
  try {
    // Generate system prompt
    const systemPrompt = createSlideSystemPrompt(slideType);
    
    // Prepare context of existing cards
    const messages = [{ role: "system", content: systemPrompt }];
    
    // Add all previous cards as context
    for (let i = 0; i < gameState.slides.length; i++) {
      messages.push(
        { role: "user", content: `${gameState.slides[i]} Card:` },
        { role: "assistant", content: gameState.content[i] }
      );
    }
    
    // Add specific request for this card type
    messages.push({ role: "user", content: `Generate a ${slideType} card for this mystery.` });
    
    // Special handling for Reveal card
    if (slideType === "Reveal") {
      // Ensure we have enough cards
      if (gameState.slides.length < CONFIG.minSlidesBeforeReveal) {
        elements.instructionBar.textContent = 
          `Need more investigation before reveal. Add at least ${CONFIG.minSlidesBeforeReveal - gameState.slides.length} more cards.`;
        setLoading(false);
        return;
      }
      
      // Special system reminder for Reveal card
      messages.push({
        role: "system",
        content: "Remember to create exactly 5 theories, 4 true and 1 false. Clearly number them as Theory #1, Theory #2, etc."
      });
      
      // Update game phase
      gameState.phase = "reveal";
    }
    
    // Call API to generate content
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    
    // Get card content
    const slideContent = response.choices[0].message.content;
    
    // For Reveal card, determine which theory is false
    if (slideType === "Reveal") {
      // Ask which theory is false
      const falseTheoryMessages = [
        ...messages,
        { role: "assistant", content: slideContent },
        { role: "user", content: "Which theory number contains a false statement? Reply with just one number 1-5." }
      ];
      
      const falseTheoryResponse = await openai.chat.completions.create({
        model: CONFIG.apiModel,
        messages: falseTheoryMessages
      });
      
      const falseTheoryContent = falseTheoryResponse.choices[0].message.content;
      const falseTheoryNumber = parseInt(falseTheoryContent.match(/\d+/)[0]);
      
      // Store correct answer
      gameState.correctAnswer = falseTheoryNumber;
      console.log(`Theory #${falseTheoryNumber} is incorrect`);
    }
    
    // Add to game state
    gameState.slides.push(slideType);
    gameState.content.push(slideContent);
    gameState.originalContent.push(slideContent);
    gameState.currentIndex = gameState.slides.length - 1;
    
    // 只生成一次图片，且Reveal卡片不生成图片
    if (slideType !== "Reveal") {
      await generateImage(slideContent, gameState.currentIndex);
    }
    // 修改：检查新卡片和现有卡片之间的强关联
    if (slideType === "Evidence" || slideType === "Character" || slideType === "Action" || slideType === "Location") {
      await checkForStrongAssociations(gameState.currentIndex);
    }
    
    // Update UI
    updateUI();
    updatePhaseIndicator();
    updateSlideHistory();
    
    // Hide loading state
    setLoading(false);
    
  } catch (error) {
    console.error(`Create ${slideType} card error:`, error);
    showError(`Create ${slideType} error: ${error.message}`);
    setLoading(false);
  }
}

// ======2025511update: Enhanced slide system prompts for richer mystery structure
function createSlideSystemPrompt(slideType) {
  // ======2025511update: base prompt remains
  let basePrompt = `You are assisting an interactive mystery game. Players insert slides to discover clues.
Your job is to generate short and essential narrative content, always in English.
Content must be extremely concise (max 2-3 sentences).
Focus only on new information that directly relates to the mystery.
All clues must make logical sense together.
Occasionally introduce elements that could strongly relate to or contradict earlier information.`;

  // ======2025511update: Enhanced prompts for each card type
  switch(slideType) {
    case "Evidence":
      // Evidence: only describe the clue, no mention of misleading/irrelevant
      return basePrompt + `\n\nFor this Evidence slide:\n- Describe one physical clue in 1-2 sentences maximum.\n- Be direct and factual, avoid speculation.\n- Focus on what's observed, not what it means.\n- Consider adding details that might confirm or contradict previously known information.`;
    case "Character":
      // Character: only describe the character as the main focus, do not mention anyone lying on the floor or similar scene description
      return basePrompt + `\n\nFor this Character slide:\n- Introduce one witness in 1-2 sentences maximum.\n- Focus on describing the character as the main subject (name, role, appearance, or background). \n- Do not generate any statement or quote.\n- The image for this card should focus on a portrait or clear depiction of the character, not the environment or a scene.\n- Keep it minimal but revealing.\n- Consider adding details about alibi, background, or connections that might relate to previous clues.`;
    case "Location":
      // New location may trigger chain reactions
      return basePrompt + `\n\nFor this Location slide:\n- Describe one place in 1-2 sentences maximum.\n- Include just one distinctive detail.\n- If this location is new, it may trigger a chain reaction: a witness may recall something new, or a new clue may be found.\n- Be direct and specific.\n- Consider including elements that might connect to previous characters or evidence.`;
    case "Action":
      // Action may upgrade/destroy evidence
      return basePrompt + `\n\nFor this Action slide:\n- Describe one investigation step in 1-2 sentences maximum.\n- This action may cause a piece of evidence to be upgraded with new information, or be destroyed/removed from the case.\n- Focus only on what is done and what it reveals.\n- Be concise and clear.\n- Consider revealing information that contradicts or provides new insight into previous evidence or statements.`;
    case "Reveal":
      return basePrompt + `\n\nFor this Reveal slide:\n1. Write exactly 5 theories (numbered 1-5).\n2. Each must be exactly 1 sentence.\n3. Four theories should be true, one false.\n4. The false one should be plausible but wrong.\n5. End with: 'Which theory is false?'`;
    default:
      return basePrompt;
  }
}

// ======2025511update: Enhanced association logic for richer chain reactions
async function checkForStrongAssociations(slideIndex) {
  // ======2025511update: keep original limit
  if (gameState.associationCount >= CONFIG.maxAssociationsPerGame) {
    console.log("Already reached maximum association triggers for this game.");
    return;
  }

  const currentSlideType = gameState.slides[slideIndex];
  const currentContent = gameState.content[slideIndex];

  // ======2025511update: Enhanced association scenarios
  const potentialTargets = [];
  for (let i = 0; i < gameState.slides.length - 1; i++) {
    if (gameState.slides[i] === "Mystery" || gameState.modifiedSlides.has(i)) {
      continue;
    }
    potentialTargets.push(i);
  }
  if (potentialTargets.length === 0) {
    return;
  }
  const shuffled = potentialTargets.sort(() => 0.5 - Math.random());
  const selectedTargets = shuffled.slice(0, Math.min(3, potentialTargets.length));

  // ======2025511update: Enhanced system prompt for association
  const systemPrompt = `You are analyzing a mystery game where players discover clues.
Your task is to determine if a new card has a strong logical connection to a previous card.
A strong connection must involve one of these specific scenarios:
1. Witness recants or changes statement due to new evidence or location (Character-Evidence/Location)
2. Evidence is upgraded with new information or destroyed due to an action or new witness (Evidence-Action/Character)
3. New location triggers a chain reaction: witness recalls something new, or a new clue is found (Location-Character/Evidence)
4. Direct contradiction, identity revelation, physical connection, alibi invalidation, or misleading information
Rate on a scale of 0.0-1.0 how strongly connected these cards are, with 0.0 being no connection and 1.0 being definitive connection.
Only high ratings (${CONFIG.associationThreshold} or higher) indicate a true connection.
If rating is below ${CONFIG.associationThreshold}, return "No strong connection."
If rating is ${CONFIG.associationThreshold} or higher, explain the exact logical relationship in one sentence, and specify the type of chain reaction (e.g., 'witness recants', 'evidence upgraded', 'evidence destroyed', 'location triggers recall').`;

  for (const targetIndex of selectedTargets) {
    const targetSlideType = gameState.slides[targetIndex];
    const targetContent = gameState.content[targetIndex];
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Previous ${targetSlideType} card: ${targetContent}\n\nNew ${currentSlideType} card: ${currentContent}\n\nIs there a strong logical connection between these cards? Rate from 0.0-1.0 and explain if ≥${CONFIG.associationThreshold}.` }
    ];
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    const analysisResult = response.choices[0].message.content;
    if (analysisResult.includes("No strong connection")) {
      console.log(`No strong connection found between card ${slideIndex} and card ${targetIndex}`);
      continue;
    }
    let rating = 0.0;
    const ratingMatch = analysisResult.match(/(\d+\.\d+)/);
    if (ratingMatch) {
      rating = parseFloat(ratingMatch[1]);
    }
    if (rating >= CONFIG.associationThreshold) {
      console.log(`Strong connection found! Rating: ${rating} between card ${slideIndex} and card ${targetIndex}`);
      let reason = analysisResult.replace(/\d+\.\d+/, "").replace(/Rating:|\r|\n/g, "").trim();
      gameState.associationTargets.push({
        sourceIndex: slideIndex,
        targetIndex: targetIndex,
        reason: reason
      });
      enterInsightChain(targetIndex);
      gameState.associationCount++;
      break;
    }
  }
}

// ======2025511update: Enhanced updateSlideWithAssociation for chain reactions
async function updateSlideWithAssociation(association) {
  try {
    const targetIndex = association.targetIndex;
    const sourceIndex = association.sourceIndex;
    const targetSlideType = gameState.slides[targetIndex];
    const sourceSlideType = gameState.slides[sourceIndex];
    const systemPrompt = `You are updating a card in a mystery game based on a strong logical connection.\nA new ${sourceSlideType} card has revealed information that directly connects to this ${targetSlideType} card.\nThe connection is: ${association.reason}\nGuidelines for the update:\n- Start with \"New insight:\" to indicate this is updated information\n- If the connection is 'witness recants', update the witness statement accordingly\n- If the connection is 'evidence upgraded', add new information to the evidence\n- If the connection is 'evidence destroyed', state that the evidence is no longer available or has been tampered with\n- If the connection is 'location triggers recall', update the witness or evidence with the new recalled information\n- Focus specifically on the logical connection between the cards\n- Keep the update to 1-2 sentences maximum\n- Be direct and clear about how this changes our understanding\n- The update should feel like an \"aha!\" moment that changes perspective`;
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Original ${targetSlideType} content: ${gameState.originalContent[targetIndex]}` },
      { role: "user", content: `New ${sourceSlideType} content that creates the connection: ${gameState.content[sourceIndex]}` },
      { role: "user", content: `Update this ${targetSlideType} card based on the strong connection. Keep it very brief (1-2 sentences).` }
    ];
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    const updatedContent = response.choices[0].message.content;
    gameState.content[targetIndex] = updatedContent;
    gameState.modifiedSlides.add(targetIndex);
    await generateImage(updatedContent, targetIndex);
    console.log(`Updated card ${targetIndex} based on connection with card ${sourceIndex}`);
    // 不在这里刷新UI和熄灭红灯
  } catch (error) {
    console.error(`Update card association error:`, error);
    gameState.content[association.targetIndex] = gameState.originalContent[association.targetIndex];
  }
}

// Submit theory answer
async function submitTheory(theoryNumber) {
  if (gameState.isLoading) return;
  if (gameState.phase !== "reveal") return;
  
  // Show loading
  setLoading(true, "Filing Final Case Report");
  
  try {
    // Check if correct
    const isCorrect = (theoryNumber === gameState.correctAnswer);
    
    // 停止背景音乐
    stopBackgroundMusic();
    
    // Create messages for conclusion
    const messages = [
      {
        role: "system",
        content: `Generate a brief conclusion for the mystery based on whether the player correctly identified the false theory.

${isCorrect ? 
  "They correctly identified the false theory. Provide a concise solution in 2-3 sentences." : 
  `They incorrectly thought Theory #${theoryNumber} was false, when Theory #${gameState.correctAnswer} was false. Provide a brief flawed conclusion.`}

Keep it under 100 words total.`
      }
    ];
    
    // Add all card history
    for (let i = 0; i < gameState.slides.length; i++) {
      messages.push(
        { role: "user", content: `${gameState.slides[i]} Card:` },
        { role: "assistant", content: gameState.content[i] }
      );
    }
    
    // Add theory choice
    messages.push({ 
      role: "user", 
      content: isCorrect ? 
        `I think Theory #${theoryNumber} is false.` : 
        `I think Theory #${theoryNumber} is false (but actually Theory #${gameState.correctAnswer} is false).`
    });
    
    // Call API to get conclusion
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    
    // Get conclusion
    const conclusion = response.choices[0].message.content;
    
    // Add to game state
    gameState.slides.push("Conclusion");
    gameState.content.push(conclusion);
    gameState.originalContent.push(conclusion);
    gameState.currentIndex = gameState.slides.length - 1;
    gameState.phase = "conclusion";
    
    // Update UI
    updateUI();
    updatePhaseIndicator();
    updateSlideHistory();
    
    // Hide theory panel
    elements.revealPanel.classList.remove('active');
    
    // Hide loading
    setLoading(false);
    
  } catch (error) {
    console.error("Submit theory error:", error);
    showError(`Generate conclusion error: ${error.message}`);
    setLoading(false);
  }
}

// Temporarily show insight badge
function showInsightBadge() {
  elements.insightBadge.classList.add('visible');
  setTimeout(() => {
    elements.insightBadge.classList.remove('visible');
  }, CONFIG.insightDuration);
}

// Set loading state
function setLoading(isLoading, message = "Processing...") {
  gameState.isLoading = isLoading;
  
  if (isLoading) {
    elements.loadingOverlay.classList.add('active');
    elements.loadingMessage.textContent = message;
  } else {
    elements.loadingOverlay.classList.remove('active');
  }
}

// Show error message
function showError(message) {
  elements.connectionStatus.textContent = "Error";
  elements.connectionStatus.classList.add('error');
  elements.instructionBar.textContent = message;
  
  // Log to console
  console.error(message);
  
  // Reset error state after delay
  setTimeout(() => {
    elements.connectionStatus.textContent = "API Ready";
    elements.connectionStatus.classList.remove('error');
  }, 5000);
}

// Update UI based on current game state
function updateUI() {
  console.log(`updateUI called, introPageIndex: ${gameState.introPageIndex}, isStandbyPage: ${gameState.isStandbyPage}`);
  
  // ===== NEW: Show standby page if active =====
  if (gameState.isStandbyPage) {
    // 为case-card添加standby模式类
    elements.caseCard.classList.add('standby-mode-active');
    elements.caseCard.classList.remove('intro-mode-active');
    
    // 设置全屏图片，隐藏其他UI元素
    elements.cardImage.style.display = 'block';
    elements.cardImage.innerHTML = `<div class="standby-container fullscreen"><img src='Standby.jpg' alt='Standby Screen'></div>`;
    
    // 隐藏所有UI元素
    elements.cardContent.className = 'card-content standby-mode';
    elements.cardContent.innerHTML = '';
    elements.cardHeader = document.querySelector('.card-header');
    if (elements.cardHeader) elements.cardHeader.style.display = 'none';
    elements.revealPanel.classList.remove('active');
    elements.slideIndicator.textContent = '';
    elements.insightBadge.classList.remove('visible');
    elements.slideHistory.innerHTML = '';
    elements.instructionBar.textContent = '';
    
    return;
  } else {
    // 移除standby模式类
    elements.caseCard.classList.remove('standby-mode-active');
    // 恢复header显示
    elements.cardHeader = document.querySelector('.card-header');
    if (elements.cardHeader) elements.cardHeader.style.display = 'flex';
  }
  
  // ===== EXISTING: Show intro pages if in intro mode =====
  if (gameState.introPageIndex !== null) {
    // 在intro页面播放待机页面音乐
    playStandbyMusic();
    
    const introData = [
      {
        img: 'intro1.png',
        html: `<div class="case-intro" style="text-align:left; padding:0 10%;">
          <h2 style="margin-bottom:1.5em; text-align:center;">You are a member of the <b>Mystery Analysis Division (MAD)</b> tasked with this investigation.</h2>
          
          <p>Before you lies a dossier of official files and fragmented photographs.</p>
          
          <p>Your mission is to uncover the truth concealed within these pages.</p>
          
          <p style="margin-top:2em;">Use <b>[Forward]</b> & <b>[Back]</b> to see different slides.</p>
        </div>`
      },
      {
        img: 'intro 2.png',
        html: `<div class="case-intro" style="text-align:left; padding:0 10%;">
          <h2 style="margin-bottom:1.5em; text-align:center;">Detective's Guide</h2>
          
          <p>During your investigation:<br>
          • Use <b>[Evidence]</b> to uncover vital clues.<br>
          • Use <b>[Character]</b> to interrogate key figures.<br>
          • Use <b>[Location]</b> to inspect relevant scenes.<br>
          • Use <b>[Action]</b> to flex your detective prowess.</p>
          
          <p style="margin-top:1em;">When you've gathered enough leads:<br>
          • Insert <b>[Reveal]</b> to open the trial.<br>
          • Choose your <b>[Choice]</b> to expose the false testimony.</p>
          
          <p style="margin-top:1em;">Press Reset button anytime to restart and return to standby screen.</p>

        </div>`
      },
      {
        img: 'intro 3.png',
        html: `<div class="case-intro" style="text-align:left; padding:0 10%;">
          <h2 style="margin-bottom:1.5em; text-align:center;">TOP SECRET DEVICE:<br>Roulettective</h2>
          
          <p><b>Roulettective</b> is a Mastermind in MAD.<br>
          It helps you <b>COLLECT</b> and <b>ASSOCIATE</b> fragments of truth.</p>
          
          <p style="margin-top:1em;">When it flashes a new insight in <b>[LIGHT]</b>,<br>
          retrace your steps to unveil <b>HIDDEN EVIDENCE</b>.</p>
          
          <p style="margin-top:2em;">Work alongside <i>Roulettective</i>—see what others cannot.</p>
          
          <p style="margin-top:2em;"><b>Press the Red Reset button to continue to standby screen</b></p>
        </div>`
      }
    ];
    const idx = gameState.introPageIndex;
    // 为case-card添加intro模式类
    elements.caseCard.classList.add('intro-mode-active');
    // Set image (left)
    elements.cardImage.style.display = 'block';
    elements.cardImage.innerHTML = `<div class="intro-mode-container"><img src='${introData[idx].img}' alt='Intro Slide ${idx+1}'></div>`;
    // Hide text on left
    elements.cardContent.className = 'card-content intro-mode';
    elements.cardContent.innerHTML = '';
    // Hide reveal panel
    elements.revealPanel.classList.remove('active');
    // Set indicator - 添加导航信息
    elements.slideIndicator.textContent = `INTRO ${idx+1}/3${navigationState.gameStarted ? " | INVESTIGATION ONGOING" : ""}`;
    // Hide insight badge
    elements.insightBadge.classList.remove('visible');
    // Journal (right): show intro text only
    elements.slideHistory.innerHTML = introData[idx].html;
    return;
  } else {
    // 移除intro模式类
    elements.caseCard.classList.remove('intro-mode-active');
  }
  
  console.log(`In updateUI, after intro check, introPageIndex: ${gameState.introPageIndex}`);
  
  // Update card content
  if (gameState.currentIndex >= 0 && gameState.currentIndex < gameState.content.length) {
    // Special handling for Reveal card format
    if (gameState.slides[gameState.currentIndex] === "Reveal") {
      // Format theories
      const content = gameState.content[gameState.currentIndex];
      let formattedContent = '';
      // Split by lines
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.trim().startsWith('Theory #')) {
          formattedContent += `<div class="theory-item">${line}</div>`;
        } else {
          formattedContent += `<p>${line}</p>`;
        }
      }
      elements.cardContent.innerHTML = formattedContent;
      elements.revealPanel.classList.add('active');
      // Update button text to English
      elements.theoryBtns.forEach((btn, index) => {
        btn.textContent = `Theory ${index + 1}`;
      });
      document.querySelector('.theory-prompt').textContent = "Which theory is false?";
    } else {
      // Regular cards
      elements.revealPanel.classList.remove('active');
      // Check if this card has been updated
      const content = gameState.content[gameState.currentIndex];
      if (gameState.modifiedSlides.has(gameState.currentIndex)) {
        // 高亮 insight
        elements.cardContent.className = "card-content updated";
        elements.cardContent.innerHTML = `<div class="insight-highlight"><p>${content.replace(/\n/g, '<br>')}</p></div>`;
      } else {
        // 普通内容也用 <p> 包裹，保留换行
        elements.cardContent.className = "card-content";
        elements.cardContent.innerHTML = `<p>${content.replace(/\n/g, '<br>')}</p>`;
      }
    }
    // 更新图片显示 - 使用新的统一格式
    if (gameState.images[gameState.currentIndex]) {
      elements.cardImage.style.display = 'block';
      // 使用updateImageDisplay函数来统一图片显示格式
      updateImageDisplay(gameState.currentIndex);
    } else {
      elements.cardImage.style.display = 'none';
    }
    // Update card indicator
    elements.slideIndicator.textContent = 
      `${gameState.slides[gameState.currentIndex]} ${gameState.currentIndex + 1}/${gameState.slides.length}${navigationState.introVisited ? " | INTRO AVAILABLE" : ""}`;
    // Add updated indicator if needed
    if (gameState.modifiedSlides.has(gameState.currentIndex)) {
      elements.slideIndicator.textContent += " ★";
    }
  } else {
    // No cards yet: do not show any welcome/standby page
    elements.cardContent.className = 'card-content';
    elements.cardContent.innerHTML = '';
    elements.slideIndicator.textContent = navigationState.introVisited ? 'INTRO AVAILABLE' : '';
    elements.revealPanel.classList.remove('active');
    elements.cardImage.style.display = 'none';
    // Journal (right): clear
    elements.slideHistory.innerHTML = '';
  }
  // Update instruction bar based on game phase
  updateInstructionBar();
  // Update button labels to English
  updateButtonLabels();
  // ======2025511update: 强制刷新case history/journal
  updateSlideHistory();
}

// Update button labels to English
function updateButtonLabels() {
  if (elements.evidenceBtn) elements.evidenceBtn.innerHTML = 'E<span>Evidence</span>';
  if (elements.characterBtn) elements.characterBtn.innerHTML = 'C<span>Character</span>';
  if (elements.locationBtn) elements.locationBtn.innerHTML = 'L<span>Location</span>';
  if (elements.actionBtn) elements.actionBtn.innerHTML = 'A<span>Action</span>';
  if (elements.revealBtn) elements.revealBtn.innerHTML = 'V<span>Reveal</span>';
  if (elements.restartBtn) elements.restartBtn.innerHTML = 'R<span>Restart</span>';
  
  if (elements.backBtn) elements.backBtn.innerHTML = '<span>⯇</span>Back (B)';
  if (elements.forwardBtn) elements.forwardBtn.innerHTML = 'Forward (F)<span>⯈</span>';
  if (elements.returnBtn) elements.returnBtn.innerHTML = '<span>⟲</span>Return (T)';
  
  // Update insight badge
  if (elements.insightBadge) elements.insightBadge.textContent = 'New Insight';
}

// Update instruction bar based on current state
function updateInstructionBar() {
  // Skip if loading
  if (gameState.isLoading) return;
  
  // 如果在待机页面
  if (gameState.isStandbyPage) {
    elements.instructionBar.textContent = "Press F to start a new mystery or B to view introduction";
    return;
  }
  
  // 如果在intro模式
  if (gameState.introPageIndex !== null) {
    // 修改intro页面的指示
    if (gameState.introPageIndex === 0) {
      elements.instructionBar.textContent = "Press B to see next introduction page or F to return to standby screen.";
    } else if (gameState.introPageIndex === 2) {
      elements.instructionBar.textContent = "Press F to see previous introduction page.";
    } else {
      elements.instructionBar.textContent = "Press B to see next introduction page or F to see previous page.";
    }
    return;
  }
  
  // 如果在游戏中，添加Restart提示
  let baseInstructions = "";
  
  // 正常游戏中的指示
  switch(gameState.phase) {
    case "initial":
      baseInstructions = "Press F to start a new mystery investigation.";
      break;
      
    case "investigating":
      if (gameState.modifiedSlides.has(gameState.currentIndex)) {
        baseInstructions = "This content has been updated with new insights.";
      } else if (gameState.slides.length < CONFIG.minSlidesBeforeReveal) {
        baseInstructions = 
          `Add more cards (E/C/L/A) to investigate. Need ${CONFIG.minSlidesBeforeReveal - gameState.slides.length} more cards before reveal.`;
      } else {
        baseInstructions = 
          "Add cards to investigate (E/C/L/A). Navigate with F/B. Press V for reveal when ready.";
      }
      break;
      
    case "reveal":
      baseInstructions = "Which theory is false? Select a theory number (1-5).";
      break;
      
    case "conclusion":
      baseInstructions = "Mystery solved. Press R to restart and return to standby screen.";
      break;
  }
  
  // 添加Restart提示，除了在结论阶段
  if (gameState.phase !== "conclusion") {
    baseInstructions += " Press R to restart and return to standby screen.";
  }
  
  elements.instructionBar.textContent = baseInstructions;
}

// Update phase indicator
function updatePhaseIndicator() {
  let phaseText = "";
  
  switch(gameState.phase) {
    case "initial":
      phaseText = "Phase: Waiting for new mystery";
      break;
    case "investigating":
      phaseText = "Phase: Active investigation";
      break;
    case "reveal":
      phaseText = "Phase: Theory evaluation";
      break;
    case "conclusion":
      phaseText = "Phase: Case closed";
      break;
  }
  
  elements.gamePhase.textContent = phaseText;
}

// Update slide history display
function updateSlideHistory() {
  // 清空历史
  elements.slideHistory.innerHTML = "";

  // 没有slide时不显示
  if (!gameState.slides || gameState.slides.length === 0) return;

  // 用fragment提升性能
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < gameState.slides.length; i++) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    // 格式化显示内容
    const slideType = gameState.slides[i];
    const slideNumber = i + 1;
    let displayText = '';
    
    // 根据不同slide类型设置不同的显示格式
    switch(slideType) {
      case 'Mystery':
        displayText = `ENTRY ${slideNumber}: MYSTERY SCENE DOCUMENTED`;
        break;
      case 'Evidence':
        displayText = `ENTRY ${slideNumber}: EVIDENCE COLLECTED`;
        break;
      case 'Character':
        displayText = `ENTRY ${slideNumber}: WITNESS INTERVIEWED`;
        break;
      case 'Location':
        displayText = `ENTRY ${slideNumber}: LOCATION INVESTIGATED`;
        break;
      case 'Action':
        displayText = `ENTRY ${slideNumber}: ACTION TAKEN`;
        break;
      case 'Reveal':
        displayText = `ENTRY ${slideNumber}: THEORIES FORMULATED`;
        break;
      case 'Conclusion':
        displayText = `ENTRY ${slideNumber}: CASE CLOSED`;
        break;
      default:
        displayText = `ENTRY ${slideNumber}: ${slideType.toUpperCase()}`;
    }
    
    historyItem.textContent = displayText;
    historyItem.setAttribute('data-index', i);
    historyItem.setAttribute('data-slide-type', slideType);

    // 高亮当前slide
    if (i === gameState.currentIndex) {
      historyItem.classList.add('active');
    }
    
    // 标记已更新slide
    if (gameState.modifiedSlides.has(i)) {
      historyItem.classList.add('updated');
    }

    // 内容预览tooltip
    const preview = gameState.content[i]
      ? gameState.content[i].replace(/<[^>]+>/g, '').substring(0, 80) + (gameState.content[i].length > 80 ? '...' : '')
      : '';
    historyItem.title = preview;

    // 点击跳转
    historyItem.addEventListener('click', async () => {
      if (gameState.currentIndex !== i) {
        gameState.currentIndex = i;
        await updateUI();
        elements.cardContent.classList.add('transition');
        setTimeout(() => {
          elements.cardContent.classList.remove('transition');
        }, 400);
      }
    });

    fragment.appendChild(historyItem);
  }

  elements.slideHistory.appendChild(fragment);

  // 自动滚动到当前项
  if (gameState.currentIndex >= 0 && gameState.currentIndex < gameState.slides.length) {
    const activeItem = elements.slideHistory.querySelector('.history-item.active');
    if (activeItem) {
      requestAnimationFrame(() => {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
    }
  }
}

// Reset game state
function resetGameState() {
  // Keep previous mysteries to ensure uniqueness
  const prevMysteries = [...gameState.previousMysteries];
  
  // 保存当前的导航状态
  const currentNavigationState = { ...navigationState };
  
  // Reset state
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
    correctAnswer: null,
    slideCounts: {
      Character: 0,
      Evidence: 0,
      Location: 0,
      Action: 0
    },
    // 重置关联机制状态
    associationCount: 0,
    associationTargets: [],
    // 重置图片状态
    images: [],
    isGeneratingImage: false,
    pendingAssociationIndex: undefined,
    // 重置音乐状态
    isMusicPlaying: false,
    // ===== MODIFIED: intro page index =====
    introPageIndex: null,       // null for normal game, 0/1/2 for intro pages
    // ===== NEW: standby page flag =====
    isStandbyPage: false        // Flag to indicate if we're on the standby page
  };
  
  // 恢复导航状态
  navigationState = currentNavigationState;
  
  // 在开始新游戏时确保关闭待机页面音乐
  stopStandbyMusic();
  
  // ======= 20250511 - Clear image container on reset
  // Reset UI elements
  elements.revealPanel.classList.remove('active');
  elements.cardContent.className = "card-content";
  elements.insightBadge.classList.remove('visible');
  elements.slideHistory.innerHTML = "";

  // ======= 20250511 - Clear image container
  const imageContainer = document.getElementById('card-image');
  if (imageContainer) {
    imageContainer.innerHTML = '';
    imageContainer.style.display = 'none';
  }

  // ======2025511update: 熄灭小灯
  if (elements.insightLight) elements.insightLight.classList.remove('active');

  updatePhaseIndicator();
}

// Support for global variable API key (if needed)
window.OPENAI_API_KEY = ""; // Set directly here if not using .env

// Initialize game when DOM is loaded
window.setup = setup;
document.addEventListener('DOMContentLoaded', setup);

// ======2025511update: summarizeForDalle，AI精炼图片prompt，死亡场景翻译为"倒在地上"
async function summarizeForDalle(longPrompt) {
  const systemPrompt = "You are an expert at summarizing crime scene descriptions for image generation. Summarize the following text into a single, vivid, English prompt under 300 characters (including spaces), focusing only on the visual scene and atmosphere. If the scene involves a dead person, always describe them as 'lying on the ground' or 'lying on the floor'. Do not include any names, dialogue, or meta information.";
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: longPrompt }
  ];
  const response = await openai.chat.completions.create({
    model: CONFIG.apiModel,
    messages: messages
  });
  return response.choices[0].message.content.trim();
}

// ======= 20250511 - Updated image display function with debugging
function updateImageDisplay(index) {
  console.log(`Updating image display for index: ${index}`);
  console.log(`Images array:`, gameState.images);
  console.log(`Image at index:`, gameState.images[index]);
  
  const imageContainer = document.getElementById('card-image');
  console.log(`Image container:`, imageContainer);
  
  if (gameState.images[index]) {
    console.log("Preparing to display image...");
    
    // Clear container first
    imageContainer.innerHTML = '';
    
    // 使用与introMode类似的包装容器来确保图片居中显示
    const wrapper = document.createElement('div');
    wrapper.className = 'image-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    
    // Create image element
    const img = new Image();
    img.onload = () => {
      console.log("Image loaded successfully");
    };
    img.onerror = () => {
      console.error("Image failed to load");
    };
    
    img.src = gameState.images[index];
    img.alt = "Generated crime scene image";
    img.style.maxWidth = '90%';
    img.style.maxHeight = '80vh';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '6px';
    img.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.5)';
    img.style.margin = '0 auto';
    img.style.display = 'block';
    
    // Add to wrapper then to container
    wrapper.appendChild(img);
    imageContainer.appendChild(wrapper);
    imageContainer.style.display = 'block';
    
    console.log("Image element added to DOM");
  } else {
    console.log("No image found, hiding container");
    imageContainer.style.display = 'none';
  }
  
  console.log(`Image display update completed`);
}

// ======2025511update: generateImage先AI精炼prompt再喂给DALL·E
async function generateImage(prompt, index) {
  try {
    // 先用AI精炼prompt
    const shortPrompt = await summarizeForDalle(prompt);
    // ======2025511update: 强制截断到300字符以内
    const safeShortPrompt = shortPrompt.slice(0, 300).trim();
    // 检查当前slide类型
    let imagePrompt;
    if (gameState.slides && gameState.slides[index] === "Character") {
      // Character卡片，生成肖像风格prompt
      imagePrompt = `A portrait of ${safeShortPrompt}, vintage 1940s film noir style, black and white, criminal scene, dramatic lighting, high contrast, grainy texture, cinematic composition`;
    } else {
      // 其他卡片类型，保持原有风格
      imagePrompt = enhancePromptForDalle(safeShortPrompt);
    }
    console.log(`Enhanced DALL-E prompt: ${imagePrompt}`);
    // Call DALL-E API to generate image
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: CONFIG.imageSize
    });
    // Get image URL
    const imageUrl = response.data[0].url;
    
    console.log(`Image generated successfully, URL: ${imageUrl}`);
    
    // Ensure images array has enough space
    while (gameState.images.length <= index) {
      gameState.images.push(null);
    }
    
    // Store image URL
    gameState.images[index] = imageUrl;
    
    // 直接更新当前显示的图片
    if (gameState.currentIndex === index) {
      updateImageDisplay(index);
    }
    
  } catch (error) {
    console.error("Generate image error:", error);
    // Even if image generation fails, don't affect game continuity
  }
}

// ======2025511update: enhancePromptForDalle直接拼接风格关键词，不再取前两句
function enhancePromptForDalle(prompt) {
  // 先过滤敏感词
  let safePrompt = filterSensitiveWords(prompt);
  // 拼接风格关键词
  let enhanced = `A vintage 1940s film noir mystery scene, black and white, dramatic lighting, high contrast, grainy texture. ${safePrompt}`;
  return enhanced;
}

// ======2025511update: enhancePromptForDalle直接拼接风格关键词，不再取前两句
function filterSensitiveWords(text) {
  const sensitiveWords = [
    'blood', 'murder', 'weapon', 'dead', 'kill', 'stab', 'wound', 'corpse', 'body', 'death',
    'suicide', 'hanged', 'strangled', 'gun', 'knife', 'shoot', 'shot', 'stabbed', 'killed',
    'victim', 'crime', 'violence', 'injury', 'bullet', 'suffocate', 'poison', 'explosion'
  ];
  let filtered = text;
  sensitiveWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, 'mystery');
  });
  return filtered;
}

// ======2025511update: navigateBack/navigateForward只在翻到pendingAssociationIndex时才更新内容和熄灭红灯
async function navigateBack() {
  if (gameState.isLoading) return;
  
  // 如果在游戏中且当前是第一页，则回到待机页面
  if (!gameState.isStandbyPage && gameState.introPageIndex === null && gameState.currentIndex === 0 && navigationState.standbyActive) {
    gameState.isStandbyPage = true;
    playStandbyMusic();
    updateUI();
    elements.cardContent.classList.add('transition');
    setTimeout(() => {
      elements.cardContent.classList.remove('transition');
    }, 400);
    return;
  }
  
  // 正常游戏内导航
  if (gameState.slides.length === 0) return;
  if (gameState.currentIndex > 0) {
    // 如果我们从当前最新的slide往回看，标记需要忽略下一次slide请求
    if (gameState.currentIndex === gameState.slides.length - 1) {
      navigationState.ignoreNextSlideRequest = true;
    }
    
    gameState.currentIndex--;
    // 检查是否翻到待更新slide
    if (gameState.pendingAssociationIndex !== undefined && gameState.currentIndex === gameState.pendingAssociationIndex) {
      setLoading(true, "Connecting Case Elements");
      const association = gameState.associationTargets.find(assoc => assoc.targetIndex === gameState.currentIndex);
      if (association) {
        await updateSlideWithAssociation(association);
      }
      setLoading(false);
      gameState.pendingAssociationIndex = undefined;
      if (elements.insightLight) elements.insightLight.classList.remove('active');
      updateUI();
      updateSlideHistory();
    } else {
      updateUI();
      updateSlideHistory();
    }
    elements.cardContent.classList.add('transition');
    setTimeout(() => {
      elements.cardContent.classList.remove('transition');
    }, 400);
  }
}

// 修改navigateForward函数，从待机页面直接开始新游戏
async function navigateForward() {
  if (gameState.isLoading) return;
  
  // 如果在待机页面，直接开始新游戏
  if (gameState.isStandbyPage) {
    gameState.isStandbyPage = false;
    stopStandbyMusic();
    gameState.introPageIndex = null;
    updateUI();
    createMysterySlide();
    return;
  }
  
  // 正常游戏内导航
  if (gameState.slides.length === 0) return;
  if (gameState.currentIndex < gameState.slides.length - 1) {
    gameState.currentIndex++;
    
    // 如果导航到了最新的slide，标记需要忽略下一次slide请求
    if (gameState.currentIndex === gameState.slides.length - 1) {
      navigationState.ignoreNextSlideRequest = true;
    }
    
    // 检查是否翻到待更新slide
    if (gameState.pendingAssociationIndex !== undefined && gameState.currentIndex === gameState.pendingAssociationIndex) {
      setLoading(true, "Connecting Case Elements");
      const association = gameState.associationTargets.find(assoc => assoc.targetIndex === gameState.currentIndex);
      if (association) {
        await updateSlideWithAssociation(association);
      }
      setLoading(false);
      gameState.pendingAssociationIndex = undefined;
      if (elements.insightLight) elements.insightLight.classList.remove('active');
      updateUI();
      updateSlideHistory();
    } else {
      updateUI();
      updateSlideHistory();
    }
    elements.cardContent.classList.add('transition');
    setTimeout(() => {
      elements.cardContent.classList.remove('transition');
    }, 400);
  }
}

// 恢复navigateReturn函数
async function navigateReturn() {
  if (gameState.isLoading) return;
  if (gameState.insightLevel <= 0) {
    elements.instructionBar.textContent = "No active connections to process.";
    return;
  }
  setLoading(true, "Analyzing Connection Patterns");
  try {
    const targetIndex = gameState.insightChain.pop();
    gameState.insightLevel--;
    if (gameState.insightLevel === 0) {
      const association = gameState.associationTargets.find(assoc => assoc.targetIndex === targetIndex);
      if (association) {
        await updateSlideWithAssociation(association);
      }
    }
    gameState.currentIndex = targetIndex;
    updateUI();
    updateSlideHistory();
    setLoading(false);
  } catch (error) {
    console.error("Return from insight chain error:", error);
    showError(`Process insight error: ${error.message}`);
    setLoading(false);
  }
}

// ======2025511update: enterInsightChain时记录pendingAssociationIndex并亮红灯
function enterInsightChain(targetIndex) {
  elements.instructionBar.textContent =
    "Strong connection discovered! Use Forward (F) or Back (B) to find the updated card.";
  gameState.pendingAssociationIndex = targetIndex;
  if (elements.insightLight) elements.insightLight.classList.add('active');
}

// 添加重启游戏功能
function restartGame() {
  if (gameState.isLoading) return;
  
  // 如果已经在待机页面，不需要任何操作
  if (gameState.isStandbyPage) return;
  
  // 停止背景音乐
  stopBackgroundMusic();
  
  // 重置游戏状态
  resetGameState();
  
  // 进入待机页面
  gameState.isStandbyPage = true;
  navigationState.standbyActive = true;
  
  // 播放待机页面音乐
  playStandbyMusic();
  
  // 更新UI
  updateUI();
}