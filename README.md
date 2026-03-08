# Roulettective - Interactive Mystery Investigation System

**Roulettective** is an advanced interactive mystery investigation game that combines AI-powered storytelling with layered reasoning mechanics. Players take on the role of a detective in the Mystery Analysis Division (MAD) to solve complex criminal cases through evidence collection, witness interviews, and logical deduction.

## 🎮 Game Features

### Core Gameplay
- **Dynamic Mystery Generation**: Each case is uniquely generated using OpenAI's GPT-4, ensuring no two investigations are the same
- **Layered Investigation System**: Collect evidence, interview witnesses, investigate locations, and take actions to build your case
- **Intelligent Association System**: The AI detects strong logical connections between clues and updates previous evidence with new insights
- **Visual Crime Scenes**: AI-generated images using DALL-E 3 create atmospheric crime scene visuals in vintage film noir style
- **Theory Evaluation**: Present 5 theories (4 true, 1 false) and test your deductive reasoning skills

### Interactive Elements
- **Real-time Audio**: Atmospheric background music and vintage jazz soundtrack
- **Arduino Integration**: Physical red light indicator that activates when new insights are discovered
- **Keyboard Navigation**: Full keyboard controls for seamless investigation flow
- **Visual Feedback**: Insight badges, updated content highlighting, and phase indicators

## 🕵️ Investigation Mechanics

### Card Types
- **Mystery**: The initial crime scene description
- **Evidence**: Physical clues and forensic findings
- **Character**: Witness interviews and suspect profiles
- **Location**: Crime scene locations and environmental details
- **Action**: Detective procedures and investigation steps
- **Reveal**: Theory presentation and final deduction

### Association System
The game features an intelligent association system that:
- Detects strong logical connections between new and existing evidence
- Automatically updates previous cards with new insights
- Triggers visual and audio alerts when connections are discovered
- Limits associations to maintain game balance

## 🎯 How to Play

### Starting a Case
1. Press `F` to start a new mystery investigation
2. Press `B` to view the introduction and game guide
3. Press `R` to restart and return to standby screen

### Investigation Controls
- `E` - Add Evidence card
- `C` - Add Character card  
- `L` - Add Location card
- `A` - Add Action card
- `V` - Generate theories (requires minimum 4 cards)

### Navigation
- `F` - Navigate forward through cards
- `B` - Navigate backward through cards
- `T` - Return to previous insight connection

### Theory Phase
- Select from 5 numbered theories
- Identify the one false theory
- Receive case conclusion based on your choice

## 🛠️ Technical Requirements

### Prerequisites
- Node.js version 16 or later
- OpenAI API key with GPT-4 and DALL-E 3 access
- Modern web browser with Web Serial API support (for Arduino integration)

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd Roulettective
```

2. Install dependencies:
```bash
npm install
```

3. Set up your OpenAI API key:
   - Create a `.env` file in the project root
   - Add your API key: `VITE_OPENAI_API_KEY=your_api_key_here`
   - The `.env` file is already in `.gitignore` for security

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:5173`

## 🔧 Arduino Integration

### Hardware Setup
- Arduino board with LED connected to pin 9
- Upload the provided `LLO_Carousel.ino` sketch to your Arduino

### Connection
- The game automatically detects Arduino connections
- A "Connect to Arduino" button appears in the bottom-right corner
- The red light activates when new insights are discovered during gameplay

## 🎨 Visual Design

### Art Style
- Vintage 1940s film noir aesthetic
- Black and white crime scene photography
- High contrast, dramatic lighting
- Grainy texture for authentic period feel

### Audio Design
- Atmospheric mystery background music
- Vintage jazz soundtrack for standby mode
- Audio cues for insight discoveries

## 🧠 AI Integration

### OpenAI Models Used
- **GPT-4o**: Primary text generation for mystery content and card creation
- **DALL-E 3**: Image generation for crime scene visuals
- **Custom Prompts**: Specialized prompts for each card type and game phase

### Content Generation
- Dynamic mystery creation with logical consistency
- Intelligent association detection between evidence
- Context-aware card updates based on new discoveries
- Balanced theory generation with exactly one false theory

## 📁 Project Structure

```
Roulettective/
├── assets/
│   └── mystery_bgm.mp3          # Background music
├── LLO_Carousel/
│   └── LLO_Carousel.ino         # Arduino sketch
├── sketch.js                     # Main game logic
├── index.html                    # Game interface
├── style.css                     # Styling
├── package.json                  # Dependencies
└── README.md                     # This file
```

## 🚀 Development

### Build Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Key Features for Developers
- Modular game state management
- Real-time UI updates with smooth transitions
- Comprehensive error handling
- Extensive logging for debugging
- Responsive design for various screen sizes

## 🎭 Game Phases

1. **Standby**: Welcome screen with atmospheric music
2. **Introduction**: Three-page tutorial explaining game mechanics
3. **Investigation**: Active case building with card collection
4. **Reveal**: Theory presentation and selection
5. **Conclusion**: Case resolution and feedback

## 🔍 Advanced Features

### Insight Chain System
- Tracks logical connections between evidence
- Provides visual feedback with red light indicator
- Updates previous cards with new information
- Maintains game balance with association limits

### Content Filtering
- Automatic filtering of sensitive content for image generation
- Safe prompt generation for DALL-E 3
- Age-appropriate mystery content

### Performance Optimization
- Efficient DOM updates with document fragments
- Image lazy loading and caching
- Smooth transitions and animations
- Memory management for large case files

## 📝 Credits and Acknowledgments

- **Original Concept**: Based on the Large Language Object (LLO) framework
- **AI Integration**: Powered by OpenAI's GPT-4 and DALL-E 3
- **Arduino Integration**: Uses p5.WebSerial library
- **Audio**: Vintage jazz recordings and atmospheric sound design
- **Development**: Built with Vite for fast development and deployment

## 🔗 Related Links

- [Original LLO Framework](https://medium.spatialpixel.com/programming-natural-language-71075fb3d428)
- [p5.WebSerial Library](https://github.com/gohai/p5.webserial)
- [OpenAI API Documentation](https://platform.openai.com/docs)

---

**Roulettective** - Where every investigation reveals new layers of truth.