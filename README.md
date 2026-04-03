# nBot Companion - Minecraft AI Bot

A Minecraft companion bot powered by Ollama (Llama 3.2) that can understand natural language commands, mine, craft, build, and chat with you!

## Features

- **Natural Language Understanding**: Talk to the bot naturally, it understands context
- **AI Conversations**: Powered by Ollama Llama 3.2 for intelligent responses
- **Action Execution**: 
  - Mining (automatically crafts tools if needed)
  - Crafting (crafts items, creates crafting tables if needed)
  - Following/Come to player
  - Inventory management
  - And more!

## Setup

### Prerequisites

1. **Minecraft Server** running on localhost:25565 (or update config)
2. **Ollama** installed with Llama 3.2:
   ```bash
   ollama pull llama3.2:latest
   ```
3. **Node.js** installed

### Installation

```bash
npm install
```

### Running the Bot

```bash
npm start
```

Or directly:

```bash
node bot.js
```

## Usage

### Talking to the Bot

The bot responds when:
- You say its name (default: "nBot-Alex")
- You include words like "bot", "alex", "hey", "hi"
- You whisper to it

### Example Commands

**Movement:**
- "Hey Alex, come here!"
- "Can you follow me?"
- "Stop please"

**Mining:**
- "Mine some stone for me"
- "Get me some wood"
- "Find some coal"

**Crafting:**
- "Make a crafting table"
- "Craft a pickaxe"
- "Create some sticks"

**Inventory:**
- "What do you have?"
- "Give me your items"
- "Equip your pickaxe"

**Status:**
- "How are you?"
- "What's your status?"

The bot will intelligently handle requests - if you ask it to mine stone but it doesn't have a pickaxe, it will craft one first!

## Configuration

Edit `CONFIG` in `bot.js`:

```javascript
const CONFIG = {
  botName: 'nBot-Alex',     // Change the bot's name
  host: 'localhost',        // Minecraft server IP
  port: 25565,             // Minecraft server port
  ollamaUrl: 'http://localhost:11434/api/generate', // Ollama endpoint
  ollamaModel: 'llama3.2:latest',  // AI model to use
};
```

## Console Commands

While the bot is running, you can type in the terminal:
- `say <message>` - Make the bot say something
- `inv` - View bot's inventory
- `pos` - View bot's position
- `status` - View health and hunger
- `help` - Show help
- `quit` - Stop the bot

## Skin

The bot uses `bot-skin.png` in the same folder. Replace this file to change the bot's appearance.

## Troubleshooting

1. **"Cannot connect"** - Make sure your Minecraft server is running and online-mode is false
2. **"Ollama error"** - Make sure Ollama is running: `ollama serve`
3. **Bot doesn't respond** - Check that the bot can see you (same world, within range)
