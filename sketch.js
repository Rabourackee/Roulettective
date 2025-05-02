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
  }
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
  }
};

// Initialize OpenAI
let openai;

// DOM elements
const elements = {};

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
  
  // Control buttons
  elements.mysteryBtn = document.getElementById('btn-mystery');
  elements.evidenceBtn = document.getElementById('btn-evidence');
  elements.characterBtn = document.getElementById('btn-character');
  elements.locationBtn = document.getElementById('btn-location');
  elements.actionBtn = document.getElementById('btn-action');
  elements.revealBtn = document.getElementById('btn-reveal');
  
  // Navigation buttons
  elements.backBtn = document.getElementById('btn-back');
  elements.forwardBtn = document.getElementById('btn-forward');
  elements.returnBtn = document.getElementById('btn-return');
  
  // Theory buttons - get all buttons with theory-btn class
  elements.theoryBtns = document.querySelectorAll('.theory-btn');
}

// Attach event listeners
function attachEventListeners() {
  // Control buttons
  elements.mysteryBtn.addEventListener('click', () => createMysterySlide());
  elements.evidenceBtn.addEventListener('click', () => createSlide('Evidence'));
  elements.characterBtn.addEventListener('click', () => createSlide('Character'));
  elements.locationBtn.addEventListener('click', () => createSlide('Location'));
  elements.actionBtn.addEventListener('click', () => createSlide('Action'));
  elements.revealBtn.addEventListener('click', () => createSlide('Reveal'));
  
  // Navigation buttons
  elements.backBtn.addEventListener('click', navigateBack);
  elements.forwardBtn.addEventListener('click', navigateForward);
  elements.returnBtn.addEventListener('click', navigateReturn);
  
  // Theory buttons
  elements.theoryBtns.forEach(button => {
    button.addEventListener('click', event => {
      const theoryNumber = parseInt(event.target.dataset.theory);
      submitTheory(theoryNumber);
    });
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', handleKeyPress);
}

// Handle keyboard shortcuts
function handleKeyPress(event) {
  // Ignore keys if loading
  if (gameState.isLoading) return;
  
  const key = event.key.toLowerCase();
  
  // Handle based on key
  switch(key) {
    // Card types
    case 'm': createMysterySlide(); break;
    case 'e': createSlide('Evidence'); break;
    case 'c': createSlide('Character'); break;
    case 'l': createSlide('Location'); break;
    case 'a': createSlide('Action'); break;
    case 'r': createSlide('Reveal'); break;
    
    // Navigation
    case 'b': navigateBack(); break;
    case 'f': navigateForward(); break;
    case 't': navigateReturn(); break;
    
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
  
  // If already in a game, confirm reset
  if (gameState.slides.length > 0) {
    if (!confirm("Starting a new mystery will reset your current progress. Continue?")) {
      return;
    }
  }
  
  // Show loading state
  setLoading(true, "Generating new mystery...");
  
  try {
    // Reset game state
    resetGameState();
    
    // Generate system prompt
    const systemPrompt = createMysterySystemPrompt();
    
    // Generate user prompt
    const userPrompt = "Create a short, concise murder mystery puzzle. End with a clear one-sentence statement of the core mystery to solve.";
    
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
    
    // Update UI
    updateUI();
    updatePhaseIndicator();
    updateSlideHistory();
    
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
  let prompt = `You are a mystery game writer. Your task is to create a short, logical murder mystery.
Guidelines:
- Keep the story simple, logical, and solvable.
- Use clear motives, locations, and limited characters.
- Limit setting to 1-2 scenes. Keep it grounded.
- Write only a single paragraph, with a one-sentence riddle at the end.
- Response must be 50-100 words total, no more.
- Do not include any meta information, instructions, or additional content.`;

  // Add previous mysteries to avoid repetition
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
  
  // 检查每种卡片类型的限制 - 修改此部分代码
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
  setLoading(true, `Generating ${slideType} content...`);
  
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
    
    // For specific cards, enter insight chain
    if (slideType === "Evidence" || slideType === "Character" || slideType === "Action") {
      enterInsightChain();
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

// Create system prompt for different card types
function createSlideSystemPrompt(slideType) {
  let basePrompt = `You are assisting an interactive mystery game. Players insert slides to discover clues.
Your job is to generate short and essential narrative content, always in English.
Content must be extremely concise (max 2-3 sentences).
Focus only on new information that directly relates to the mystery.
All clues must make logical sense together.`;

  // Add specific instructions based on card type
  switch(slideType) {
    case "Evidence":
      return basePrompt + `\n\nFor this Evidence slide:\n- Describe one physical clue in 1-2 sentences maximum.\n- Be direct and factual, avoid speculation.\n- Focus on what's observed, not what it means.`;
      
    case "Character":
      return basePrompt + `\n\nFor this Character slide:\n- Introduce one person in 1-2 sentences maximum.\n- Include only their name, role, and a very brief statement.\n- Keep it minimal but revealing.`;
      
    case "Location":
      return basePrompt + `\n\nFor this Location slide:\n- Describe one place in 1-2 sentences maximum.\n- Include just one distinctive detail.\n- Be direct and specific.`;
      
    case "Action":
      return basePrompt + `\n\nFor this Action slide:\n- Describe one investigation step in 1-2 sentences maximum.\n- Focus only on what is done and what it reveals.\n- Be concise and clear.`;
      
    case "Reveal":
      return basePrompt + `\n\nFor this Reveal slide:\n1. Write exactly 5 theories (numbered 1-5).\n2. Each must be exactly 1 sentence.\n3. Four theories should be true, one false.\n4. The false one should be plausible but wrong.\n5. End with: 'Which theory is false?'`;
      
    default:
      return basePrompt;
  }
}

// Enter insight chain
function enterInsightChain() {
  // Only enter if not already in insight chain
  if (gameState.insightLevel === 0) {
    gameState.insightLevel = 1;
    gameState.insightChain.push(gameState.currentIndex);
    elements.instructionBar.textContent = 
      "New insight path found. Add more cards or press T to process insight.";
    updateInsightIndicator();
  }
}

// Update insight depth indicator
function updateInsightIndicator() {
  elements.depthLevel.textContent = gameState.insightLevel;
  
  // If in insight chain, add visual class
  if (gameState.insightLevel > 0) {
    elements.depthLevel.parentElement.classList.add('active');
  } else {
    elements.depthLevel.parentElement.classList.remove('active');
  }
}

// Navigate backward
function navigateBack() {
  if (gameState.isLoading) return;
  
  if (gameState.slides.length === 0) {
    elements.instructionBar.textContent = "No cards yet. Press M to start a mystery.";
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
    elements.instructionBar.textContent = "Already at the first card.";
  }
}

// Navigate forward
function navigateForward() {
  if (gameState.isLoading) return;
  
  if (gameState.slides.length === 0) {
    elements.instructionBar.textContent = "No cards yet. Press M to start a mystery.";
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
    elements.instructionBar.textContent = "Already at the last card. Add more content to continue.";
  }
}

// Return navigation (from insight chain)
async function navigateReturn() {
  if (gameState.isLoading) return;
  
  // Check if in insight chain
  if (gameState.insightLevel <= 0) {
    elements.instructionBar.textContent = "Not in an insight chain.";
    return;
  }
  
  // Show loading state
  setLoading(true, "Processing insight...");
  
  try {
    // Get index to return to
    const returnIndex = gameState.insightChain.pop();
    
    // Reduce insight level
    gameState.insightLevel--;
    
    // If exiting chain completely, update earlier cards
    if (gameState.insightLevel === 0) {
      await updateSlidesWithNewInsights();
    }
    
    // Go to return index
    gameState.currentIndex = returnIndex;
    
    // Update UI
    updateUI();
    updateInsightIndicator();
    updateSlideHistory();
    
    // Hide loading
    setLoading(false);
    
  } catch (error) {
    console.error("Return from insight chain error:", error);
    showError(`Process insight error: ${error.message}`);
    setLoading(false);
  }
}

// Update cards after completing insight chain
async function updateSlidesWithNewInsights() {
  // Identify cards that should be updated
  const slidesToUpdate = [];
  
  // Find out which cards should be updated based on discoveries
  for (let i = 0; i < gameState.slides.length - 1; i++) {
    // Skip already updated cards
    if (gameState.modifiedSlides.has(i)) {
      continue;
    }
    
    // Character cards affected by Evidence or Action
    if (gameState.slides[i] === "Character") {
      // Look for subsequent Evidence or Action cards
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
    
    // Evidence cards affected by Character or Action
    if (gameState.slides[i] === "Evidence") {
      // Look for subsequent Character or Action cards
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
    
    // Location cards affected by any subsequent card
    if (gameState.slides[i] === "Location") {
      // Check if there are any subsequent cards
      if (i < gameState.slides.length - 1) {
        slidesToUpdate.push(i);
      }
    }
  }
  
  // Skip if no cards to update
  if (slidesToUpdate.length === 0) {
    elements.instructionBar.textContent = "No cards to update with new insights.";
    return;
  }
  
  // Update indicator while processing
  elements.instructionBar.textContent = `Updating cards with new insights...`;
  
  // Update each card
  for (let i = 0; i < slidesToUpdate.length; i++) {
    const index = slidesToUpdate[i];
    
    // Update loading message to show progress
    elements.loadingMessage.textContent = 
      `Updating ${gameState.slides[index]} card (${i + 1}/${slidesToUpdate.length})...`;
    
    // Update card
    await updateSlideWithNewInsights(index);
    
    // Mark as modified
    gameState.modifiedSlides.add(index);
  }
  
  // Show completion
  elements.instructionBar.textContent = 
    `Updated cards with deeper insights.`;
  
  // If currently viewing an updated card, refresh content
  if (gameState.modifiedSlides.has(gameState.currentIndex)) {
    showInsightBadge();
  }
}

// Update specific card with new insights
async function updateSlideWithNewInsights(slideIndex) {
  try {
    // Create system prompt based on card type
    const slideType = gameState.slides[slideIndex];
    const systemPrompt = createUpdateSystemPrompt(slideType);
    
    // Create messages array
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    
    // Add original content
    messages.push({ 
      role: "user", 
      content: `Original ${slideType} content: ${gameState.originalContent[slideIndex]}`
    });
    
    // Add all content discovered after this card
    let laterDiscoveries = "Later discoveries:";
    for (let i = slideIndex + 1; i < gameState.slides.length; i++) {
      laterDiscoveries += `\n\n${gameState.slides[i]} Card: ${gameState.content[i]}`;
    }
    
    messages.push({ role: "user", content: laterDiscoveries });
    
    // Request update
    messages.push({ 
      role: "user", 
      content: `Update this ${slideType} card based on new discoveries. Keep it very brief (1-2 sentences).`
    });
    
    // Call API
    const response = await openai.chat.completions.create({
      model: CONFIG.apiModel,
      messages: messages
    });
    
    // Get updated content
    const updatedContent = response.choices[0].message.content;
    
    // Update game state
    gameState.content[slideIndex] = updatedContent;
    
  } catch (error) {
    console.error(`Update card ${slideIndex} error:`, error);
    // Fall back to original content on failure
    gameState.content[slideIndex] = gameState.originalContent[slideIndex];
  }
}

// Create system prompt for updating cards
function createUpdateSystemPrompt(slideType) {
  let basePrompt = `You are updating a card in a mystery game with new insights. Be extremely concise.

Guidelines:
- Start with "New insight:" to indicate this is updated information
- Reveal one key new interpretation based on later discoveries
- Keep the update to 1-2 sentences maximum
- Focus only on key information, no extra details
- Be direct and clear`;

  return basePrompt;
}

// Submit theory answer
async function submitTheory(theoryNumber) {
  if (gameState.isLoading) return;
  if (gameState.phase !== "reveal") return;
  
  // Show loading
  setLoading(true, "Generating conclusion...");
  
  try {
    // Check if correct
    const isCorrect = (theoryNumber === gameState.correctAnswer);
    
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
      if (gameState.modifiedSlides.has(gameState.currentIndex)) {
        // Format with insight highlighting
        const content = gameState.content[gameState.currentIndex];
        
        // Add special class for updated content
        elements.cardContent.className = "card-content updated";
        
        // If content starts with "New insight:" or similar, wrap in insight div
        if (/^New insight:|^Upon further|^A closer look/i.test(content)) {
          const firstSentenceEnd = content.indexOf('.');
          if (firstSentenceEnd > 0) {
            const firstPart = content.substring(0, firstSentenceEnd + 1);
            const restContent = content.substring(firstSentenceEnd + 1);
            elements.cardContent.innerHTML = `<div class="insight-highlight">${firstPart}</div>${restContent}`;
          } else {
            elements.cardContent.textContent = content;
          }
        } else {
          elements.cardContent.textContent = content;
        }
      } else {
        // Regular unmodified content
        elements.cardContent.className = "card-content";
        elements.cardContent.textContent = gameState.content[gameState.currentIndex];
      }
    }
    
    // Update card indicator
    elements.slideIndicator.textContent = 
      `${gameState.slides[gameState.currentIndex]} ${gameState.currentIndex + 1}/${gameState.slides.length}`;
    
    // Add updated indicator if needed
    if (gameState.modifiedSlides.has(gameState.currentIndex)) {
      elements.slideIndicator.textContent += " ★";
    }
    
  } else {
    // No cards yet
    elements.cardContent.innerHTML = `
      <p>Welcome to the Layered Reasoning Mystery Game.</p>
      <p>Press <kbd>M</kbd> to start a new investigation.</p>
      <p>Each mystery contains hidden layers of truth that will be revealed as your investigation deepens.</p>`;
    elements.slideIndicator.textContent = "Welcome";
    elements.revealPanel.classList.remove('active');
  }
  
  // Update instruction bar based on game phase
  updateInstructionBar();
  
  // Update insight indicator
  updateInsightIndicator();
  
  // Update button labels to English
  updateButtonLabels();
}

// Update button labels to English
function updateButtonLabels() {
  if (elements.mysteryBtn) elements.mysteryBtn.innerHTML = 'M<span>Mystery</span>';
  if (elements.evidenceBtn) elements.evidenceBtn.innerHTML = 'E<span>Evidence</span>';
  if (elements.characterBtn) elements.characterBtn.innerHTML = 'C<span>Character</span>';
  if (elements.locationBtn) elements.locationBtn.innerHTML = 'L<span>Location</span>';
  if (elements.actionBtn) elements.actionBtn.innerHTML = 'A<span>Action</span>';
  if (elements.revealBtn) elements.revealBtn.innerHTML = 'R<span>Reveal</span>';
  
  if (elements.backBtn) elements.backBtn.innerHTML = '<span>⯇</span>Back (B)';
  if (elements.forwardBtn) elements.forwardBtn.innerHTML = 'Forward (F)<span>⯈</span>';
  if (elements.returnBtn) elements.returnBtn.innerHTML = '<span>⟲</span>Return (T)';
  
  // Update depth indicator
  document.querySelector('.depth-label').textContent = 'Insight Depth:';
  
  // Update insight badge
  elements.insightBadge.textContent = 'New Insight';
}

// Update instruction bar based on current state
function updateInstructionBar() {
  // Skip if loading
  if (gameState.isLoading) return;
  
  switch(gameState.phase) {
    case "initial":
      elements.instructionBar.textContent = "Press M key to start a new mystery investigation.";
      break;
      
    case "investigating":
      if (gameState.insightLevel > 0) {
        elements.instructionBar.textContent = 
          `In insight chain (level ${gameState.insightLevel}). Press T to process or continue exploring.`;
      } else if (gameState.modifiedSlides.has(gameState.currentIndex)) {
        elements.instructionBar.textContent = "This content has been updated with new insights.";
      } else if (gameState.slides.length < CONFIG.minSlidesBeforeReveal) {
        elements.instructionBar.textContent = 
          `Add more cards (E/C/L/A) to investigate. Need ${CONFIG.minSlidesBeforeReveal - gameState.slides.length} more cards before reveal.`;
      } else {
        elements.instructionBar.textContent = 
          "Add cards to investigate (E/C/L/A). Navigate with F/B. Press R for reveal when ready.";
      }
      break;
      
    case "reveal":
      elements.instructionBar.textContent = "Which theory is false? Select a theory number (1-5).";
      break;
      
    case "conclusion":
      elements.instructionBar.textContent = "Mystery solved. Press M to start a new investigation.";
      break;
  }
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
  // Clear current history
  elements.slideHistory.innerHTML = "";
  
  // Add each card
  for (let i = 0; i < gameState.slides.length; i++) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.textContent = `${i + 1}: ${gameState.slides[i]}`;
    
    // Add active class for current card
    if (i === gameState.currentIndex) {
      historyItem.classList.add('active');
    }
    
    // Add updated class for modified cards
    if (gameState.modifiedSlides.has(i)) {
      historyItem.classList.add('updated');
    }
    
    // Add click event to navigate
    historyItem.addEventListener('click', () => {
      if (!gameState.isLoading) {
        gameState.currentIndex = i;
        updateUI();
      }
    });
    
    // Add to history
    elements.slideHistory.appendChild(historyItem);
  }
}

// Reset game state
function resetGameState() {
  // Keep previous mysteries to ensure uniqueness
  const prevMysteries = [...gameState.previousMysteries];
  
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
    }
  };
  
  // Reset UI elements
  elements.revealPanel.classList.remove('active');
  elements.cardContent.className = "card-content";
  elements.insightBadge.classList.remove('visible');
  elements.slideHistory.innerHTML = "";
  updatePhaseIndicator();
}

// Support for global variable API key (if needed)
window.OPENAI_API_KEY = ""; // Set directly here if not using .env

// Initialize game when DOM is loaded
window.setup = setup;
document.addEventListener('DOMContentLoaded', setup);