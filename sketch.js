import './style.css';

// JavaScript and Node.js imports, installed typically with npm install.
import OpenAI from 'openai';


// Declare globals.
// Put your OpenAI API key here.
//const apiKey = put your api key here or use .env file'; 
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

let openai;

// @@@@@ 2025-04-08: Add message history to maintain conversation context @@@@@
let messageHistory = [
  {
    role: "system",
    content:
      "You are a clever and slightly mysterious game master. " +
      "You're hosting a game of lateral thinking puzzles (also known as 'situation puzzles' or 'yes/no riddles'). " +
      "You present short, strange scenarios that hide an unexpected truth. The player can ask yes/no questions to figure it out. " +
      "Only reply with 'yes', 'no', or 'irrelevant', unless the player is very close to the answer. " +
      "If they're close enough or on the very right track, reveal the full story. " +
      "Keep your tone engaging, curious, and slightly dramatic." +
      "Keep a count of the total number of questions asked, if it reached 20, show that the user run out of question and reveal the full story directly." +
      "When you are describing the puzzle, write only the story and no need to respond in any way apart from the story."
  }
];
// @@@@@ End of addition @@@@@

// +++++ 2025-04-08: Add variables to separately store story and responses +++++
let storyText = "";
let responseText = "";
// +++++ End of addition +++++

// Keep all non-P5.js code outside of the sketch() function as much as possible.
// This just makes things cleaner and enables you to break them out into
// separate modules if need be. P5.js doesn't support modules without p. notation.


/////////////// PROMPT FROM TEXT INPUT //////////////////////
// Add an event listener to the text input.
async function initializePromptInput (callback) {
  const promptInput = document.getElementById('prompt-input');
  
  if (promptInput) {
    promptInput.addEventListener('keydown', async function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        
        // Get the text from the text input element.
        const prompt = promptInput.value;
        
        // @@@@@ 2025-04-08: Update to use the message history @@@@@
        // Add user message to history
        messageHistory.push({
          role: "user",
          content: prompt
        });
        
        // Call the OpenAI API with the full conversation history
        const completion = await chatWithHistory();
        
        // Clear the input field
        promptInput.value = "";
        // @@@@@ End of modification @@@@@
        
        // +++++ 2025-04-08: Update only the response text, not the story +++++
        responseText = completion;
        callback(completion);
        // +++++ End of modification +++++
      } // end check for Enter
    }); // end addEventListener click
  } // end check for promptInput existence
}

// @@@@@ 2025-04-08: Modified to use message history @@@@@
async function chatWithHistory() {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messageHistory
    });
  
    // Add assistant's response to history
    const responseContent = completion.choices[0].message.content;
    messageHistory.push({
      role: "assistant",
      content: responseContent
    });
    
    return responseContent;
  } catch (err) {
    console.error("An error occurred in the chat function:", err);
    return "An error occurred."
  }
}
// @@@@@ End of modification @@@@@

// @@@@@ 2025-04-08: Keep this function for backward compatibility @@@@@
// Sends a single prompt to the OpenAI completions API.
async function chat(prompt) {
  // Add user message to history
  messageHistory.push({
    role: "user",
    content: prompt
  });
  
  // Use the shared function
  return chatWithHistory();
}
// @@@@@ End of modification @@@@@


/////////////// PROMPT FROM USER KEY PRESS //////////////////////
// variable for coloring the square
let generatedColor = '#FFFF00';

// Sends a single prompt to the OpenAI completions API.
async function sendToOpenAI(promptNew) {
  //try {
    console.log("Prompt: " + promptNew);
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          "role": "user",
          "content": promptNew
        }
      ]
    });


    let result = await completion.choices[0].message.content;
    console.log("Result: " + result);
    generatedColor = result;
  
    //return completion.choices[0].message.content;
  //} catch (err) {
   // console.error("An error occurred in the chat function:", err);
   // return "An error occurred."
  //}

}

// ======= 2025-04-08: Fixed bug where generating a new story doesn't properly clear old story =======
async function getStoryFromGPT(promptNew, callback) {
  try {
    console.log("Sending story prompt to GPT...");
    
    // Clear the existing story and response immediately to prevent display issues
    storyText = "";
    responseText = "";
    
    // Reset the message history to just the system message
    messageHistory = [
      {
        role: "system",
        content:
          "You are a clever and slightly mysterious game master. " +
          "You're hosting a game of lateral thinking puzzles (also known as 'situation puzzles' or 'yes/no riddles'). " +
          "You present short, strange scenarios that hide an unexpected truth. The player can ask yes/no questions to figure it out. " +
          "Only reply with 'yes', 'no', or 'irrelevant', unless the player is very close to the answer. " +
          "If they're close enough or on the very right track, reveal the full story. " +
          "Keep your tone engaging, curious, and slightly dramatic." +
          "Keep a count of the total number of questions asked, if it reached 20, show that the user run out of question and reveal the full story directly." +
          "When you are describing the puzzle, write only the story and no need to respond in any way apart from the story."
      }
    ];
    
    // Add user's initial prompt to the history
    messageHistory.push({
      role: "user",
      content: promptNew
    });
    
    // Get completion using the shared history
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messageHistory
    });

    let result = completion.choices[0].message.content;
    console.log("Story received from GPT");
    
    // Add assistant's response to the history
    messageHistory.push({
      role: "assistant",
      content: result
    });
    
    // Set the new story
    storyText = result;
    
    callback(result);
  } catch (err) {
    console.error("An error occurred while getting the story:", err);
    callback("An error occurred while getting the story.");
  }
}
// ======= End of fix =======




// =====================================================================================
// THIS IS WHERE P5.JS CODE STARTS
// =====================================================================================

// This is the function passed to P5.js that provides the object, p, that
// holds the core functionality of P5.js.
const sketch = p => {
  // Put any sketch-specific state here.
  
  let textToShow = "";  // This is the text that will be displayed on the canvas.

  let port; // variable to hold the serial port object

  let responseFromOpenAI; // variable to hold the color response from OpenAI API

  ////////// P5.JS SETUP //////////
  p.setup = function () {

    // Provide a callback function to the text prompt for when a successful
    // completion is returned from the OpenAI API. This helps ensure the
    // sketch state, textToShow, remains inside the sketch() function.
    const callback = function (completion) {
      textToShow = completion;
    };
    initializePromptInput(callback);
    
    // Initialize the serial port object
    port = p.createSerial();
    
    // Set up the canvas
    p.createCanvas(500, 500);


  } // end setup
  


   ////////// P5.JS DRAW //////////
   p.draw = function () {

    // Draw a text field to show text message retuned from OpenAI
    p.background(p.color('grey'));
    p.fill(p.color('black'));
    p.textSize(20);
    
    // +++++ 2025-04-08: Modified text display to show story and responses separately +++++
    const maxWidth = 400;
    const lineHeight = 25;
    let y = 70;
    
    // Draw the story text (if available)
    if (storyText) {
      p.fill(p.color('black'));
      p.textStyle(p.BOLD);
      p.text("PUZZLE:", 50, y);
      y += lineHeight;
      
      const storyWords = storyText.split(' ');
      let line = '';
      
      for (let i = 0; i < storyWords.length; i++) {
        const testLine = line + storyWords[i] + ' ';
        if (p.textWidth(testLine) > maxWidth) {
          p.text(line, 50, y);
          line = storyWords[i] + ' ';
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      p.text(line, 50, y);
      y += lineHeight * 2;  // Add extra space between story and response
    }
    
    // Draw the response text (if available)
    if (responseText) {
      p.fill(p.color('blue'));
      p.textStyle(p.NORMAL);
      p.text("RESPONSE:", 50, y);
      y += lineHeight;
      
      const responseWords = responseText.split(' ');
      let line = '';
      
      for (let i = 0; i < responseWords.length; i++) {
        const testLine = line + responseWords[i] + ' ';
        if (p.textWidth(testLine) > maxWidth) {
          p.text(line, 50, y);
          line = responseWords[i] + ' ';
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      p.text(line, 50, y);
    }
    // +++++ End of modification +++++

    // Draw a square based on the color returned from OpenAI
    p.fill(p.color(generatedColor));
    p.rect(0, 0, 50, 50);

    // Read data from the serial port and if something available, print it to console
    let str = port.read();
    if (str.length > 0) {
      console.log(str);
    }

  } // end draw


////////// P5.JS KEYBOARD INPUT //////////
p.keyPressed = function () {

  // @@@@@ 2025-04-08: Changed to use Tab, [, ], and \ keys @@@@@
  // Tab key (keyCode 9): Get a color from GPT (was 'c')
  if (p.keyCode === 9) { // Tab key
    sendToOpenAI("What is the color of the sky? Respond with RGB HEX code only. No explanations.");
  }

  // ======= 2025-04-08: Modified to properly handle story generation =======
  // Left bracket [ key (keyCode 219): Get a story from GPT (was 'r')
  if (p.keyCode === 219) { // [ key
    // Clear both text displays when generating a new story
    storyText = "";
    responseText = "";
    textToShow = "Generating story...";
    getStoryFromGPT("Start the game", (story) => {
      textToShow = story;
    });
  }
  // ======= End of modification =======

  // Right bracket ] key (keyCode 221): Connect to serial port (was 's')
  if (p.keyCode === 221) { // ] key
    port.open(9600);
  }

  // Backslash \ key (keyCode 220): LED high (was 'h')
  if (p.keyCode === 220) { // \ key
    port.write("H");
  }
  
  // Print the key code to the console for debugging
  console.log("Key pressed: " + p.key + " (keyCode: " + p.keyCode + ")");
  // @@@@@ End of modification @@@@@

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