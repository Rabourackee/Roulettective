import './style.css';

// JavaScript and Node.js imports, installed typically with npm install.
import OpenAI from 'openai';


// Declare globals.
// Put your OpenAI API key here.
//const apiKey = put your api key here or use .env file'; 
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

let openai;

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
        
        // Call the OpenAI API to get a completion from the prompt.
        const completion = await chat(prompt);
        callback(completion);
      } // end check for Enter
    }); // end addEventListener click
  } // end check for promptInput existence
}


// Sends a single prompt to the OpenAI completions API.
async function chat (prompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          "role": "user",
          "content": prompt
        }
      ]
    });
  
    return completion.choices[0].message.content;
  } catch (err) {
    console.error("An error occurred in the chat function:", err);
    return "An error occurred."
  }
}


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

// ===== ADDED 2025-04-08: New function to get story from GPT with game master system prompt =====
async function getStoryFromGPT(promptNew, callback) {
  try {
    console.log("Sending story prompt to GPT...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a clever and slightly mysterious game master. " +
            "You're hosting a game of lateral thinking puzzles (also known as 'situation puzzles' or 'yes/no riddles'). " +
            "You present short, strange scenarios that hide an unexpected truth. The player can ask yes/no questions to figure it out. " +
            "Only reply with 'yes', 'no', or 'irrelevant', unless the player is very close to the answer. " +
            "If they're close, give a subtle hint. Once they've solved it or are extremely close, reveal the full story. " +
            "Start the game with a puzzle involving an apple. Keep your tone engaging, curious, and slightly dramatic." +
            "When you are describing the puzzle, write only the story and no need to respond in any way apart from the story."
        },
        {
          "role": "user",
          "content": promptNew
        }
      ]
    });

    let result = completion.choices[0].message.content;
    console.log("Story received from GPT");
    callback(result);
  } catch (err) {
    console.error("An error occurred while getting the story:", err);
    callback("An error occurred while getting the story.");
  }
}
// ===== END OF ADDITION 2025-04-08 =====




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
    
    // ===== MODIFIED 2025-04-08: Improved text display with word wrapping =====
    const maxWidth = 400;
    const lineHeight = 25;
    const words = textToShow.split(' ');
    let line = '';
    let y = 70;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      if (p.textWidth(testLine) > maxWidth) {
        p.text(line, 50, y);
        line = words[i] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    p.text(line, 50, y);
    // ===== END OF MODIFICATION 2025-04-08 =====

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

    // Ask GPT for a color
    if (p.key === 'c') {
      sendToOpenAI("What is the color of the sky? Respond with RGB HEX code only. No explanations.");
    }

    // ===== ADDED 2025-04-08: Get a story from GPT when 'r' key is pressed =====
    if (p.key === 'r') {
      textToShow = "Generating story...";
      getStoryFromGPT("Start the game", (story) => {
        textToShow = story;
      });
    }
    // ===== END OF ADDITION 2025-04-08 =====

    // connect to serial port
    if (p.key === 's') {
      port.open(9600);
    //console.log(port);
    }

    // send serial data to Arduino to toggle LED
    // LED high
    if (p.key === 'h') {
      port.write("H");
    }
    // LED low
    if (p.key === 'l') {
      port.write("L");
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
