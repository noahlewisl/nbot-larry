# nBot Companion - Minecraft AI Bot (Linux Mint Edition)

A Minecraft companion bot powered by Ollama (Llama 3.2) that runs on Linux Mint while you game on Windows!

## Architecture

```
Linux Mint (AI Worker)          Windows PC (Gaming Rig)
├── Ollama AI (llama3.2)        ├── Minecraft
├── This Bot                     ├── OBS
└── Minecraft Server (optional)  └── Discord/Browser/etc
```

## Prerequisites (Linux Mint)

1. **Install Ollama:**
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ollama pull llama3.2:latest
   ```

2. **Install Node.js:**
   ```bash
   sudo apt update
   sudo apt install nodejs npm
   ```

3. **Install Git (to clone this repo):**
   ```bash
   sudo apt install git
   ```

## Installation

1. **Copy this folder to your Linux Mint laptop** (USB, SCP, or Git)

2. **Install dependencies:**
   ```bash
   cd Minecraft-Bot-companie
   npm install
   ```

3. **Copy your skin file:**
   - Put your `bot-skin.png` in this folder

## Configuration

Edit `bot.js` to set your Windows PC's Minecraft server IP:

```javascript
const CONFIG = {
  botName: 'nBot-Alex',
  host: '192.168.1.X',  // <-- Your Windows PC IP or server IP
  port: 25565,
  ollamaUrl: 'http://localhost:11434/api/generate',  // Local Ollama
  ollamaModel: 'llama3.2:latest',
};
```

Find your Windows PC IP:
- On Windows: `ipconfig` → look for "IPv4 Address"
- On Linux: `ip addr show` (to verify connection)

## Running

### 1. Start Ollama (Linux Mint)

Ollama runs as a service by default. Check if it's running:
```bash
ollama list
```

If you need to restart it:
```bash
sudo systemctl restart ollama
```

### 2. Start Minecraft Server

**Option A - Windows hosts server:**
- Start Minecraft server on Windows
- Use Windows IP in `bot.js` config

**Option B - Linux hosts server:**
- Install Java on Linux: `sudo apt install openjdk-17-jre-headless`
- Download server jar and run it
- Use `localhost` in `bot.js` config
- Connect Windows Minecraft to Linux IP

**Option C - External server:**
- Use a free server like Aternos
- Put the server IP in `bot.js`

### 3. Start the Bot (Linux Mint)

```bash
npm start
```

The bot will connect to the Minecraft server from Linux, while you play from Windows!

## Usage

Talk to the bot in Minecraft chat. It responds when you:
- Say its name ("nBot-Alex")
- Include "bot" or "hey"
- Whisper to it

### Example Commands
- "Hey Alex, come here" - Bot walks to you
- "Mine some stone" - Bot mines and crafts tools if needed
- "Craft a pickaxe" - Bot crafts one
- "What do you see?" - Bot describes surroundings

## Troubleshooting

**"Connection refused" to Minecraft:**
- Check Windows Firewall - allow Java/Minecraft through
- Verify the IP in `bot.js` matches Windows PC
- Make sure server is in online-mode=false (for local LAN)

**"Ollama connection error":**
- Check Ollama is running: `ollama list`
- If needed: `sudo systemctl start ollama`

**Bot can't see you:**
- Make sure you're in the same Minecraft world/server
- Check bot is actually connected (console shows "spawned")

**Performance:**
- Llama 3.2 uses ~2GB RAM - make sure Linux has enough
- For slower laptops, responses may take 10-30 seconds

## Network Setup

If Windows hosts the server:

1. **Windows Firewall:**
   - Allow `java.exe` through firewall
   - Allow port 25565

2. **Minecraft server.properties:**
   ```
   online-mode=false
   server-ip=0.0.0.0
   ```

3. **Router (if playing over internet):**
   - Port forward 25565 to Windows PC
   - Or use LAN only (same network)

## Linux-Specific Commands

```bash
# Check if Ollama is running
ollama list

# View Ollama logs
sudo journalctl -u ollama -f

# Check what's using port 11434
sudo lsof -i :11434

# Restart Ollama
sudo systemctl restart ollama

# Allow Minecraft server port through firewall
sudo ufw allow 25565/tcp
```

## Performance Tips

**If Linux laptop is slow:**

1. Use a smaller model:
   ```bash
   ollama pull llama3.2:1b  # 1B parameter version, much faster
   ```
   Then update `bot.js`: `ollamaModel: 'llama3.2:1b'`

2. Reduce timeout in `bot.js` if needed

3. Close unnecessary apps on Linux while bot runs

## Files

- `bot.js` - Main bot code (edit this for config)
- `bot-skin.png` - Bot's Minecraft skin
- `package.json` - Dependencies
- `README.md` - This file

## License

MIT - Do whatever you want with it!
