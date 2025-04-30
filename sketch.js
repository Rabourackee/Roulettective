import './style.css';

// JavaScript and Node.js imports, installed typically with npm install.
import OpenAI from 'openai';

// Declare globals.
// Put your OpenAI API key here.
//const apiKey = put your api key here or use .env file'; 
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

let openai;

// MODIFIED: 2025-04-14 12:10
// Game state object to keep track of the mystery progress
const gameState = {
  currentStory: "",         // The current mystery story being told
  slidesUsed: [],           // Track which slides have been used
  previousResponses: [],    // Store AI responses to each slide
  evidenceFound: 0,         // Count of evidence slides used
  charactersIntroduced: 0,  // Count of character slides used
  explorationsDone: 0,      // Count of exploration slides used
  storyStarted: false,      // Whether a story has been started with a Riddle Slide
  gameMessage: "Welcome to the Mystery Projector! Press 'r' to insert a Riddle Slide and begin a new mystery."
};

// MODIFIED: 2025-04-14 11:30
// Slide commands mapped to keyboard commands
const slideCommands = {
  r: "Riddle Slide",     // 'r' key for Riddle Slide
  e: "Evidence Slide",   // 'e' key for Evidence Slide
  c: "Character Slide",  // 'c' key for Character Slide
  x: "Exploration Slide", // 'x' key for Exploration Slide
  v: "Reveal Slide",     // 'v' key for Reveal Slide
  h: "Help"              // 'h' key for game help (not part of the original system)
};

// MODIFIED: 2025-04-14 12:15
// Function to send slide commands to OpenAI
async function sendSlideCommand(commandKey) {
  try {
    const slideCommand = slideCommands[commandKey];
    
    if (!slideCommand) {
      gameState.gameMessage = "Invalid slide type. Try one of the available slides.";
      return;
    }
    
    // Handle special case for help command
    if (slideCommand === "Help") {
      gameState.gameMessage = `
Mystery Projector Help:
- Press 'r' to insert a Riddle Slide (starts a new mystery)
- Press 'e' to insert an Evidence Slide (reveals physical clues)
- Press 'c' to insert a Character Slide (introduces key characters)
- Press 'x' to insert an Exploration Slide (analyzes previous clues)
- Press 'v' to insert a Reveal Slide (attempts to solve the mystery)
- Press 'h' for this help screen

Begin by pressing 'r' to start a new mystery!`;
      return;
    }
    
    // Handle special case: Riddle Slide starts a new story
    if (slideCommand === "Riddle Slide") {
      gameState.slidesUsed = []; 
      gameState.previousResponses = [];
      gameState.evidenceFound = 0;
      gameState.charactersIntroduced = 0;
      gameState.explorationsDone = 0;
      gameState.storyStarted = true;
    }
    
    // Check if trying to use a slide before starting the story
    if (!gameState.storyStarted && slideCommand !== "Riddle Slide") {
      gameState.gameMessage = "You must insert a Riddle Slide first to begin a mystery.";
      return;
    }
    
    // Track the use of this slide
    gameState.slidesUsed.push(slideCommand);
    
    // Update specific counters based on slide type
    if (slideCommand === "Evidence Slide") gameState.evidenceFound++;
    if (slideCommand === "Character Slide") gameState.charactersIntroduced++;
    if (slideCommand === "Exploration Slide") gameState.explorationsDone++;
    
    console.log("Sending slide command: " + slideCommand);
    
    // Create messages array with the system prompt from the mystery projector
    const messages = [
      {
        "role": "system",
        "content": `
You are an AI-powered narrative puzzle engine embedded in a physical interactive device inspired by vintage slide projectors. Players interact with you by inserting physical slides of specific types.

🎮 The player does **not type** questions or dialogue. They only send one of the following **fixed keyword commands** to you as input:

  • "Riddle Slide"
  • "Evidence Slide"
  • "Character Slide"
  • "Exploration Slide"
  • "Reveal Slide"

Each keyword corresponds to a physical slide inserted by the player. You must respond to each of these commands by generating narrative content in your role as a mystery puzzle system.

---

🔧 Your job is to:

- Create a complete and immersive mystery story that unfolds over time.
- Respond ONLY to the 5 fixed commands above. These are the only instructions you will ever receive.
- Treat each slide as a functional trigger. The type and sequence of slides define how the story is revealed.
- Handle all aspects of story generation, pacing, clue delivery, and logic evaluation.
- Track narrative progress and determine when the player has enough clues to unlock the mystery.

🧩 Slide Behavior:

1. **Riddle Slide** – Generates a mysterious scenario that hints at a deeper hidden truth. It starts the story. Style should resemble "Turtle Soup" lateral-thinking riddles, with eerie, strange, or puzzling setups.

2. **Evidence Slide** – Reveals one concrete object or physical clue from the current story. Each new Evidence Slide shows a different object. If all relevant items have been revealed, show an empty slide that says: "No more evidence can be found."

3. **Character Slide** – Introduces a key character involved in the mystery. When multiple Character Slides are used, introduce them in order of relevance. Include brief psychological or historical details if useful.

4. **Exploration Slide** – Allows the player to analyze any one previously introduced clue, character, or concept. Reveal deeper context, backstory, new associations, or generate new items/people to be revealed later.

5. **Reveal Slide** – The player tries to solve the mystery. You must assess whether they have enough information. If so, generate a full, surprising, and satisfying resolution. If not, say that more information is needed and suggest what to explore.

---

🎭 Tone & Style Guidelines:

- Keep everything **in-world** and **immersive**. You are not a chatbot or narrator. You are the intelligence inside the device.
- Storytelling should feel cinematic, progressive, and well-paced. Let the mystery build gradually.
- Ensure each story has a **distinct genre and mood**: one may be folklore, another time-travel, another a domestic crime or cult mystery.
- Avoid repetition across stories (e.g., don't overuse science experiments or memory loss).
- Only allow a successful Reveal when the player has uncovered enough evidence and context.
- Do not repeat information from previous slides. Keep each slide fresh.
- Do not allow the player to skip ahead too quickly; deny early "Reveal" attempts when appropriate.

---

💡 Sample Interaction:

> Player inserts: "Riddle Slide"  
You respond:  
---
🔮 **Riddle Slide – Projecting**  
A man is found dead at the base of his apartment building. His shoes are dry, his clothes wet. The top floor window is closed from the inside. A note in his pocket reads: "The last rain already fell."  
🧩 The mystery begins. Insert slides to investigate.

> Player inserts: "Evidence Slide"  
You respond:  
---
🟠 **Evidence Slide #1 – Projecting**  
📌 A broken umbrella with the man's initials, found by the trash chute. No rain was reported that week.  
🧩 One clue uncovered. There may be more.

> Player inserts: "Reveal Slide"  
You respond:  
---
🟥 **Reveal Slide – Projecting**  
⚠️ Insufficient information to resolve the mystery. Consider exploring more characters or clues.

---

🎮 Your output for each slide should follow this structure:

- Header (e.g., "🟠 Evidence Slide #2 – Projecting")
- Vivid narrative description of what appears on the slide
- Newly unlocked clues or leads clearly marked with icons (e.g., 📌, 🧩)
- A final prompt: suggested next actions (insert another slide, explore something, etc.)

🛑 DO NOT start any mystery until the player inserts the first "Riddle Slide". After that, the story is yours to shape — based entirely on the player's physical slide inputs.
`
      }
    ];
    
    // Add all previous slide commands and responses as context for the AI
    for (let i = 0; i < gameState.slidesUsed.length - 1; i++) {
      // Add the user's previous slide command
      messages.push({
        "role": "user",
        "content": gameState.slidesUsed[i]
      });
      
      // Add the AI's previous response for this slide
      messages.push({
        "role": "assistant",
        "content": gameState.previousResponses[i] || "No previous response available"
      });
    }
    
    // Add the current slide command that we're processing
    messages.push({
      "role": "user",
      "content": slideCommand
    });
    
    // Send the request to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages
    });

    // Get the response and update the game state
    const result = completion.choices[0].message.content;
    console.log("Received response: " + result);
    
    // Store the AI's response
    gameState.previousResponses.push(result);
    
    // Update the game message to show this response
    gameState.gameMessage = result;
    
    return result;
  } catch (err) {
    console.error("An error occurred in the slide command function:", err);
    gameState.gameMessage = "The projector mechanism jammed. Try again.";
    return "An error occurred.";
  }
}

// MODIFIED: 2025-04-14 11:38
// Functions to handle specific slide commands
async function insertRiddleSlide() {
  return sendSlideCommand("r");
}

async function insertEvidenceSlide() {
  return sendSlideCommand("e");
}

async function insertCharacterSlide() {
  return sendSlideCommand("c");
}

async function insertExplorationSlide() {
  return sendSlideCommand("x");
}

async function insertRevealSlide() {
  return sendSlideCommand("v");
}

async function showHelp() {
  return sendSlideCommand("h");
}

// =====================================================================================
// THIS IS WHERE P5.JS CODE STARTS
// =====================================================================================

// This is the function passed to P5.js that provides the object, p, that
// holds the core functionality of P5.js.
const sketch = p => {
  // Put any sketch-specific state here.
  let port; // variable to hold the serial port object

  // MODIFIED: 2025-04-14 11:40
  // Visual elements for the projector game
  let font;
  let projectorOverlay;
  let slideSound;
  
  // MODIFIED: 2025-04-14 11:42
  // Preload game assets
  p.preload = function() {
    font = p.loadFont('https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceSansPro-Regular.otf');
    // In a real implementation, you would load actual images:
    // projectorOverlay = p.loadImage('path/to/projector-frame.png');
    // slideSound = p.loadSound('path/to/slide-click.mp3');
  }

  ////////// P5.JS SETUP //////////
  p.setup = function () {
    // MODIFIED: 2025-04-14 12:25
    // Set up the canvas for the projector game
    p.createCanvas(800, 600);
    p.textFont(font);
    p.textSize(18);
    p.background(20, 20, 25);
    
    // Initialize the serial port object (if needed for hardware integration)
    port = p.createSerial();
    
    // Set the game message to the welcome message
    gameState.gameMessage = "Welcome to the Mystery Projector! Press 'r' to insert a Riddle Slide and begin a new mystery.";
    
    // Initialize the game at startup
    drawProjectorInterface();
  } // end setup
  
  // MODIFIED: 2025-04-14 12:20
  // Function to display the projector interface
  function drawProjectorInterface() {
    // Create a dark background like a dimly lit room
    p.background(20, 20, 25);
    
    // Draw the projector screen (lighter rectangle in center)
    p.fill(40, 40, 45);
    p.noStroke();
    p.rect(50, 50, p.width - 100, p.height - 150, 5);
    
    // Draw projector light effect
    p.fill(255, 255, 255, 30);
    p.beginShape();
    p.vertex(p.width/2, p.height - 50);
    p.vertex(100, 100);
    p.vertex(p.width - 100, 100);
    p.endShape(p.CLOSE);
    
    // Draw slide content area with a vintage projector feel
    p.fill(240, 240, 220);
    p.rect(100, 100, p.width - 200, p.height - 250, 2);
    
    // Draw the message content (the slide)
    p.fill(20, 20, 20);
    p.textSize(18);
    p.textLeading(26); // Line spacing for readability
    
    // Format and display the slide content - handle different emoji headers
    const messageText = gameState.gameMessage;
    p.text(messageText, 120, 120, p.width - 240, p.height - 290);
    
    // Draw slide indicators at the bottom
    p.fill(200, 200, 180);
    p.textSize(14);
    p.text("Slides Used: " + (gameState.slidesUsed.length > 0 ? gameState.slidesUsed.join(" → ") : "None"), 100, p.height - 70);
    
    // Draw command help
    p.fill(180, 180, 160);
    p.textSize(14);
    const commands = "[R]iddle [E]vidence [C]haracter e[X]ploration re[V]eal [H]elp";
    p.text(commands, p.width/2 - p.textWidth(commands)/2, p.height - 30);
  }

  ////////// P5.JS DRAW //////////
  p.draw = function () {
    // MODIFIED: 2025-04-14 11:48
    // Draw the projector interface
    drawProjectorInterface();

    // Read data from the serial port (for potential physical hardware integration)
    let str = port.read();
    if (str.length > 0) {
      console.log(str);
      
      // In a full implementation, you could map hardware inputs to slide commands
      // For example, if a physical slide is inserted, it could send "R" for Riddle Slide
      if (str.toUpperCase() === "R") {
        insertRiddleSlide();
      }
    }
  } // end draw

  // MODIFIED: 2025-04-14 11:50
  ////////// P5.JS KEYBOARD INPUT //////////
  p.keyPressed = function () {
    // Add slide projector sound effect (commented out as placeholder)
    // if (slideSound && ["r", "e", "c", "x", "v"].includes(p.key.toLowerCase())) {
    //   slideSound.play();
    // }
    
    // Mystery projector control keys
    switch(p.key.toLowerCase()) {
      case 'r': // Riddle Slide
        insertRiddleSlide();
        break;
      case 'e': // Evidence Slide
        insertEvidenceSlide();
        break;
      case 'c': // Character Slide
        insertCharacterSlide();
        break;
      case 'x': // Exploration Slide
        insertExplorationSlide();
        break;
      case 'v': // Reveal Slide
        insertRevealSlide();
        break;
      case 'h': // Help
        showHelp();
        break;
      case 's': // Connect to serial port (for hardware integration)
        port.open(9600);
        break;
    }
  } // end keyPressed
} // end sketch function


// =====================================================================================
// This is initialization code for P5.js and OpenAI.
// There's typically no need to bother with this.

// Initialize P5.js and OpenAI.
function onReady () {
  // Initialize the OpenAI API instance.
  openai = new OpenAI({
    apiKey: apiKey,
  
    // This is ONLY for prototyping locally on your personal machine!
    dangerouslyAllowBrowser: true
  });

  const mainElt = document.querySelector('main');
  new p5(sketch, mainElt);
} // end onReady

if (document.readyState === 'complete') {
  onReady();
} else {
  document.addEventListener("DOMContentLoaded", onReady);
}